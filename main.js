const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const Store = require('electron-store');
const LicenseManager = require('./license-manager');

// Configurações persistentes
const store = new Store({
    defaults: {
        outputFolder: '',
        backgroundsFolder: '',
        autoSave: true,
        chromaSettings: {
            tolerance: 35,
            quality: 8,
            spillReduction: 20
        },
        windowBounds: {
            width: 1400,
            height: 900
        },
        autoOpenFolder: true,
        imageFormat: 'png',
        imageQuality: 95,
        autoGenerateOnQRScan: true
    }
});

let mainWindow;
let activationWindow; // ← NOVO
let currentOutputFolder = store.get('outputFolder');
let currentBackgroundsFolder = store.get('backgroundsFolder');
const licenseManager = new LicenseManager();

// ========================================
// JANELA PRINCIPAL
// ========================================
function createWindow() {
    const bounds = store.get('windowBounds');
    
    mainWindow = new BrowserWindow({
        width: bounds.width,
        height: bounds.height,
        minWidth: 1200,
        minHeight: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: 'Green Screen Studio Desktop',
        show: false,
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
    });

    // Carregar a interface
    mainWindow.loadFile('index.html');

    // Mostrar quando estiver pronto
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Enviar configurações iniciais
        mainWindow.webContents.send('config-loaded', {
            outputFolder: currentOutputFolder,
            settings: store.get('chromaSettings'),
            autoSave: store.get('autoSave'),
            autoOpenFolder: store.get('autoOpenFolder')
        });
    });

    // Salvar posição da janela
    mainWindow.on('close', () => {
        store.set('windowBounds', mainWindow.getBounds());
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Menu da aplicação
    createMenu();

    // DevTools apenas em desenvolvimento
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }
}

// ========================================
// JANELA DE ATIVAÇÃO (NOVO)
// ========================================
function createActivationWindow() {
    activationWindow = new BrowserWindow({
        width: 600,
        height: 750,
        resizable: false,
        center: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: 'Ativação - Green Screen Studio'
    });

    activationWindow.loadFile('activation.html');

    activationWindow.on('closed', () => {
        activationWindow = null;
        
        // Se fechar janela de ativação sem ativar, fechar app
        if (!mainWindow) {
            app.quit();
        }
    });
}

// ========================================
// IPC HANDLERS - LICENCIAMENTO (NOVO)
// ========================================

// Obter Hardware ID
ipcMain.handle('get-hardware-id', async () => {
    try {
        const hwid = await licenseManager.getHardwareId();
        return hwid;
    } catch (error) {
        console.error('Erro ao obter Hardware ID:', error);
        return null;
    }
});

// Ativar Licença
ipcMain.handle('activate-license', async (event, licenseKey) => {
    try {
        console.log('🔑 Tentando ativar licença:', licenseKey);
        const result = await licenseManager.activate(licenseKey);
        
        if (result.success) {
            console.log('✅ Licença ativada com sucesso!');
        } else {
            console.log('❌ Falha na ativação:', result.error);
        }
        
        return result;
    } catch (error) {
        console.error('Erro ao ativar licença:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

// Obter informações da licença
ipcMain.handle('get-license-info', async () => {
    try {
        const info = await licenseManager.getLicenseInfo();
        return info;
    } catch (error) {
        console.error('Erro ao obter info da licença:', error);
        return null;
    }
});

// Desativar licença
ipcMain.handle('deactivate-license', async () => {
    try {
        const result = await licenseManager.deactivate();
        return { success: result };
    } catch (error) {
        console.error('Erro ao desativar:', error);
        return { success: false, error: error.message };
    }
});

// Ativação completa - abrir janela principal
ipcMain.on('activation-complete', () => {
    if (activationWindow) {
        activationWindow.close();
        activationWindow = null;
    }
    createWindow();
});

// Abrir página de compra
ipcMain.on('open-purchase-page', () => {
    shell.openExternal('https://seu-site.com/comprar');
});

// Abrir suporte
ipcMain.on('open-support', () => {
    shell.openExternal('https://seu-site.com/suporte');
});

// Abrir FAQ
ipcMain.on('open-faq', () => {
    shell.openExternal('https://seu-site.com/faq');
});

// ========================================
// MENU
// ========================================
function createMenu() {
    const template = [
        {
            label: 'Arquivo',
            submenu: [
                {
                    label: 'Escolher Pasta de Destino',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => selectOutputFolder()
                },
                {
                    label: 'Abrir Pasta de Destino',
                    accelerator: 'CmdOrCtrl+E',
                    click: () => openOutputFolder(),
                    enabled: !!currentOutputFolder
                },
                { type: 'separator' },
                {
                    label: 'Configurações',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => openSettings()
                },
                { type: 'separator' },
                {
                    label: 'Sair',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'Editar',
            submenu: [
                { label: 'Desfazer', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                { label: 'Refazer', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
                { type: 'separator' },
                { label: 'Recortar', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                { label: 'Copiar', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                { label: 'Colar', accelerator: 'CmdOrCtrl+V', role: 'paste' }
            ]
        },
        {
            label: 'Licença', // ← NOVO MENU
            submenu: [
                {
                    label: 'Informações da Licença',
                    click: async () => {
                        const info = await licenseManager.getLicenseInfo();
                        if (info) {
                            dialog.showMessageBox(mainWindow, {
                                type: 'info',
                                title: 'Informações da Licença',
                                message: 'Licença Ativa',
                                detail: `Chave: ${info.license_key}\n` +
                                       `Tipo: ${info.license_type}\n` +
                                       `Ativada em: ${new Date(info.activated_at).toLocaleDateString()}\n` +
                                       `Expira: ${info.expires_at ? new Date(info.expires_at).toLocaleDateString() : 'Nunca'}`
                            });
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Desativar Licença',
                    click: async () => {
                        const result = await dialog.showMessageBox(mainWindow, {
                            type: 'warning',
                            title: 'Desativar Licença',
                            message: 'Tem certeza que deseja desativar a licença?',
                            detail: 'Você precisará ativar novamente para usar o software.',
                            buttons: ['Cancelar', 'Desativar'],
                            defaultId: 0,
                            cancelId: 0
                        });

                        if (result.response === 1) {
                            await licenseManager.deactivate();
                            app.relaunch();
                            app.quit();
                        }
                    }
                }
            ]
        },
        {
            label: 'Visualizar',
            submenu: [
                { label: 'Recarregar', accelerator: 'CmdOrCtrl+R', role: 'reload' },
                { label: 'Forçar Recarregar', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
                { label: 'Ferramentas do Desenvolvedor', accelerator: 'F12', role: 'toggleDevTools' },
                { type: 'separator' },
                { label: 'Zoom Real', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
                { label: 'Ampliar', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
                { label: 'Reduzir', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
                { type: 'separator' },
                { label: 'Tela Cheia', accelerator: 'F11', role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Ajuda',
            submenu: [
                {
                    label: 'Sobre',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Sobre Green Screen Studio',
                            message: 'Green Screen Studio Desktop v1.0.0',
                            detail: 'Aplicação profissional para remoção automática de fundo verde.\n\nDesenvolvido para uso comercial e profissional.',
                            buttons: ['OK']
                        });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Comprar Licença',
                    click: () => shell.openExternal('https://seu-site.com/comprar')
                },
                {
                    label: 'Suporte',
                    click: () => shell.openExternal('https://seu-site.com/suporte')
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// ========================================
// IPC Handlers - FUNCIONAIS EXISTENTES
// ========================================
ipcMain.handle('select-output-folder', selectOutputFolder);
ipcMain.handle('select-backgrounds-folder', selectBackgroundsFolder);

ipcMain.handle('load-backgrounds-from-folder', async () => {
    if (!currentBackgroundsFolder) {
        return { success: false, backgrounds: [] };
    }
    
    try {
        const files = await fs.readdir(currentBackgroundsFolder);
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext);
        });
        
        const backgrounds = [];
        
        for (const file of imageFiles) {
            const filePath = path.join(currentBackgroundsFolder, file);
            const data = await fs.readFile(filePath);
            const base64 = `data:image/${path.extname(file).slice(1)};base64,${data.toString('base64')}`;
            
            backgrounds.push({
                name: path.basename(file, path.extname(file)),
                filename: file,
                data: base64
            });
        }
        
        console.log(`✅ Carregados ${backgrounds.length} fundos de: ${currentBackgroundsFolder}`);
        
        return {
            success: true,
            backgrounds,
            folder: currentBackgroundsFolder
        };
        
    } catch (error) {
        console.error('❌ Erro ao carregar fundos:', error);
        return { success: false, backgrounds: [], error: error.message };
    }
});

ipcMain.handle('save-images-batch', async (event, images, sessionInfo = null) => {
    if (!currentOutputFolder) {
        throw new Error('Nenhuma pasta de destino selecionada');
    }

    const results = [];
    let sessionFolder;
    
    try {
        // Determinar pasta do cliente
        if (sessionInfo && sessionInfo.sessionFolder) {
            sessionFolder = path.join(currentOutputFolder, sessionInfo.sessionFolder);
        } else if (sessionInfo && sessionInfo.sessionCode) {
            sessionFolder = path.join(currentOutputFolder, sessionInfo.sessionCode);
        } else {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
            sessionFolder = path.join(currentOutputFolder, `Cliente_${timestamp}`);
        }
        
        // Criar pastas
        const originalsFolder = path.join(sessionFolder, 'originais');
        await fs.mkdir(sessionFolder, { recursive: true });
        await fs.mkdir(originalsFolder, { recursive: true });
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('💾 SALVANDO IMAGENS');
        console.log('📁 Cliente:', sessionFolder);
        console.log('📁 Originais:', originalsFolder);
        console.log('🖼️ Total de imagens:', images.length);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // ✅ DEBUG: Verificar se imagens têm originalData
        console.log('\n🔍 DEBUG - Verificando originalData:');
        images.forEach((img, i) => {
            console.log(`  ${i + 1}. ${img.filename}`);
            console.log(`     Tem originalData? ${!!img.originalData}`);
            console.log(`     poseId: ${img.poseId}`);
        });

        // ✅ AGRUPAR POR POSE ID (mais confiável que regex)
        const photoGroups = new Map();
        
        images.forEach(image => {
            const poseId = image.poseId || 'unknown';
            
            if (!photoGroups.has(poseId)) {
                photoGroups.set(poseId, []);
            }
            photoGroups.get(poseId).push(image);
        });

        console.log(`\n📊 ${photoGroups.size} poses agrupadas`);

        // ✅ SALVAR ORIGINAIS (um por pose)
        console.log('\n📸 SALVANDO ORIGINAIS:');
        let originalsCount = 0;
        
        for (const [poseId, groupImages] of photoGroups.entries()) {
            console.log(`\n  Pose ${poseId}:`);
            console.log(`    Grupo tem ${groupImages.length} imagens`);
            
            if (groupImages.length > 0) {
                const firstImage = groupImages[0];
                console.log(`    Primeira imagem: ${firstImage.filename}`);
                console.log(`    Tem originalData? ${!!firstImage.originalData}`);
                
                if (firstImage.originalData) {
                    const originalFilename = `Pose_${poseId}_original.png`;
                    const originalPath = path.join(originalsFolder, originalFilename);
                    
                    try {
                        const base64Data = firstImage.originalData.replace(/^data:image\/\w+;base64,/, '');
                        const buffer = Buffer.from(base64Data, 'base64');
                        
                        await fs.writeFile(originalPath, buffer);
                        originalsCount++;
                        console.log(`    ✓ Salvo: ${originalFilename} (${(buffer.length / 1024).toFixed(1)} KB)`);
                    } catch (err) {
                        console.error(`    ❌ Erro ao salvar original:`, err.message);
                    }
                } else {
                    console.log(`    ⚠️ originalData não encontrado!`);
                }
            }
        }

        // ✅ SALVAR PROCESSADAS
        console.log('\n🎨 SALVANDO PROCESSADAS:');
        
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            const filename = image.filename;
            const filepath = path.join(sessionFolder, filename);
            
            const base64Data = image.data.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            await fs.writeFile(filepath, buffer);
            
            results.push({
                filename,
                filepath,
                success: true
            });

            console.log(`  ${i + 1}/${images.length} ✓ ${filename}`);

            mainWindow.webContents.send('save-progress', {
                current: i + 1,
                total: images.length,
                filename
            });
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ SALVAMENTO CONCLUÍDO!');
        console.log(`📸 ${originalsCount} originais salvos`);
        console.log(`🎨 ${results.length} processadas salvas`);
        console.log('📂 Pasta:', sessionFolder);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (store.get('autoOpenFolder')) {
            shell.openPath(sessionFolder);
        }

        return {
            success: true,
            folder: sessionFolder,
            originalsFolder: originalsFolder,
            count: results.length,
            originalsCount: originalsCount,
            results,
            clientCode: sessionInfo?.sessionCode || sessionInfo?.sessionFolder || null
        };

    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        throw error;
    }
});

ipcMain.handle('get-config', () => {
    return {
        outputFolder: currentOutputFolder,
        backgroundsFolder: currentBackgroundsFolder,
        settings: store.get('chromaSettings'),
        autoSave: store.get('autoSave'),
        autoOpenFolder: store.get('autoOpenFolder'),
        autoGenerateOnQRScan: store.get('autoGenerateOnQRScan'),
        imageFormat: store.get('imageFormat'),
        imageQuality: store.get('imageQuality')
    };
});

ipcMain.handle('save-config', (event, config) => {
    if (config.chromaSettings) {
        store.set('chromaSettings', config.chromaSettings);
    }
    if (config.autoSave !== undefined) {
        store.set('autoSave', config.autoSave);
    }
    if (config.autoOpenFolder !== undefined) {
        store.set('autoOpenFolder', config.autoOpenFolder);
    }
    if (config.autoGenerateOnQRScan !== undefined) {
        store.set('autoGenerateOnQRScan', config.autoGenerateOnQRScan);
    }
    if (config.imageFormat) {
        store.set('imageFormat', config.imageFormat);
    }
    if (config.imageQuality !== undefined) {
        store.set('imageQuality', config.imageQuality);
    }
    
    return true;
});

ipcMain.handle('open-output-folder', openOutputFolder);

async function selectOutputFolder() {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Escolher Pasta de Destino para as Imagens',
        defaultPath: currentOutputFolder || app.getPath('pictures')
    });

    if (!result.canceled && result.filePaths.length > 0) {
        currentOutputFolder = result.filePaths[0];
        store.set('outputFolder', currentOutputFolder);
        
        createMenu();
        mainWindow.webContents.send('output-folder-changed', currentOutputFolder);
        
        return currentOutputFolder;
    }
    
    return null;
}

async function selectBackgroundsFolder() {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Escolher Pasta com os Fundos (Backgrounds)',
        defaultPath: currentBackgroundsFolder || app.getPath('pictures')
    });

    if (!result.canceled && result.filePaths.length > 0) {
        currentBackgroundsFolder = result.filePaths[0];
        store.set('backgroundsFolder', currentBackgroundsFolder);
        
        console.log('📁 Pasta de fundos selecionada:', currentBackgroundsFolder);
        mainWindow.webContents.send('backgrounds-folder-changed', currentBackgroundsFolder);
        
        return currentBackgroundsFolder;
    }
    
    return null;
}

function openOutputFolder() {
    if (currentOutputFolder) {
        shell.openPath(currentOutputFolder);
    }
}

function openSettings() {
    mainWindow.webContents.send('open-settings');
}

// ========================================
// APP EVENTS - MODIFICADO PARA LICENCIAMENTO
// ========================================
app.whenReady().then(async () => {
    console.log('🚀 Green Screen Studio Desktop iniciando...');
    
    // Verificar se está ativado
    const isActivated = await licenseManager.isActivated();
    
    if (isActivated) {
        console.log('✅ Licença válida - iniciando aplicação');
        createWindow();
    } else {
        console.log('⚠️ Licença não encontrada - mostrando tela de ativação');
        createActivationWindow();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Prevenir navegação externa
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        shell.openExternal(navigationUrl);
    });
});

// Log de erros
process.on('uncaughtException', (error) => {
    console.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Promise rejeitada:', error);
});

