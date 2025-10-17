const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const Store = require('electron-store');

// Configurações persistentes
const store = new Store({
    defaults: {
        outputFolder: '',
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
        imageQuality: 95
    }
});

let mainWindow;
let currentOutputFolder = store.get('outputFolder');

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

    // Menu da aplicação
    createMenu();

    // DevTools apenas em desenvolvimento
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }
}

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
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('select-output-folder', selectOutputFolder);

ipcMain.handle('save-images-batch', async (event, images, sessionInfo = null) => {
    if (!currentOutputFolder) {
        throw new Error('Nenhuma pasta de destino selecionada');
    }

    const results = [];
    let sessionFolder;
    
    try {
        // Criar pasta da sessão
        if (sessionInfo && sessionInfo.sessionFolder) {
            sessionFolder = path.join(currentOutputFolder, sessionInfo.sessionFolder);
        } else {
            // Fallback para pasta com timestamp se não houver sessão
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
            sessionFolder = path.join(currentOutputFolder, `GreenScreen_${timestamp}`);
        }
        
        await fs.mkdir(sessionFolder, { recursive: true });

        // Salvar cada imagem
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            
            // Se há info da sessão, incluir o código no nome do arquivo
            let filename;
            if (sessionInfo && sessionInfo.sessionCode) {
                filename = `${sessionInfo.sessionCode}_${image.filename}`;
            } else {
                filename = image.filename;
            }
            
            const filepath = path.join(sessionFolder, filename);
            
            // Converter base64 para buffer
            const base64Data = image.data.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Salvar arquivo
            await fs.writeFile(filepath, buffer);
            
            results.push({
                filename,
                filepath,
                success: true
            });

            // Enviar progresso
            mainWindow.webContents.send('save-progress', {
                current: i + 1,
                total: images.length,
                filename
            });
        }

        // Criar arquivo de informações da sessão
        if (sessionInfo && sessionInfo.sessionCode) {
            const sessionInfoFile = {
                sessionCode: sessionInfo.sessionCode,
                timestamp: new Date().toISOString(),
                imageCount: images.length,
                backgrounds: [...new Set(images.map(img => img.filename.split('_').pop()))],
                poses: [...new Set(images.map(img => img.poseId))],
                generated: 'Green Screen Studio Desktop v1.0'
            };
            
            const infoPath = path.join(sessionFolder, `sessao_${sessionInfo.sessionCode}.json`);
            await fs.writeFile(infoPath, JSON.stringify(sessionInfoFile, null, 2));
        }

        // Abrir pasta automaticamente se configurado
        if (store.get('autoOpenFolder')) {
            shell.openPath(sessionFolder);
        }

        return {
            success: true,
            folder: sessionFolder,
            count: results.length,
            results,
            clientCode: sessionInfo?.sessionCode || null
        };

    } catch (error) {
        throw error;
    }
});

ipcMain.handle('get-config', () => {
    return {
        outputFolder: currentOutputFolder,
        settings: store.get('chromaSettings'),
        autoSave: store.get('autoSave'),
        autoOpenFolder: store.get('autoOpenFolder'),
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
        
        // Atualizar menu
        createMenu();
        
        // Notificar renderer
        mainWindow.webContents.send('output-folder-changed', currentOutputFolder);
        
        return currentOutputFolder;
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

// App Events
app.whenReady().then(createWindow);

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