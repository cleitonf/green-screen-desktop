class DesktopGreenScreenStudio {
    constructor() {
        this.poses = [];
        this.backgrounds = [];
        this.stream = null;
        this.currentSession = null;
        this.settings = {
            tolerance: 35,
            quality: 8,
            spillReduction: 20
        };
        this.config = {};
        this.outputFolder = '';
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadElectronConfig();
        this.loadDefaultBackgrounds();
        this.updateUI();
    }

    initializeElements() {
        this.video = document.getElementById('videoElement');
        this.canvas = document.getElementById('canvasElement');
        this.ctx = this.canvas.getContext('2d');
        
        // Buttons
        this.selectFolderBtn = document.getElementById('selectFolderBtn');
        this.openFolderBtn = document.getElementById('openFolderBtn');
        this.startCameraBtn = document.getElementById('startCamera');
        this.captureBtn = document.getElementById('capturePhoto');
        this.stopCameraBtn = document.getElementById('stopCamera');
        this.clearPosesBtn = document.getElementById('clearPoses');
        
        // QR Code elements
        this.qrCodeInput = document.getElementById('qrCodeInput');
        this.setSessionBtn = document.getElementById('setSessionBtn');
        this.clearSessionBtn = document.getElementById('clearSessionBtn');
        this.currentSessionDisplay = document.getElementById('currentSessionDisplay');
        this.sessionFolderPath = document.getElementById('sessionFolderPath');
        this.sessionFolderInfo = document.getElementById('sessionFolderInfo');
        
        // Checklist elements
        this.checkFolder = document.getElementById('checkFolder');
        this.checkPoses = document.getElementById('checkPoses');
        this.checkBackgrounds = document.getElementById('checkBackgrounds');
        
        // Display elements
        this.poseCountSpan = document.getElementById('poseCount');
        this.backgroundCountSpan = document.getElementById('backgroundCount');
        this.statusText = document.getElementById('statusText');
        this.poseStatus = document.getElementById('poseStatus');
        this.totalCombinations = document.getElementById('totalCombinations');
        this.posesGrid = document.getElementById('posesGrid');
        this.backgroundsGrid = document.getElementById('backgroundsGrid');
        this.cameraSection = document.getElementById('cameraSection');
        this.outputFolderDisplay = document.getElementById('outputFolderDisplay');
        this.outputFolderPath = document.getElementById('outputFolderPath');
        
        // Progress elements
        this.processingSection = document.getElementById('processingSection');
        this.progressSection = document.getElementById('progressSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.folderInfo = document.getElementById('folderInfo');
        this.completionMessage = document.getElementById('completionMessage');
        
        // Processing overlay
        this.processingOverlay = document.getElementById('processingOverlay');
        this.processingTitle = document.getElementById('processingTitle');
        this.processingStatus = document.getElementById('processingStatus');
        this.processingDetails = document.getElementById('processingDetails');
        
        // Input elements
        this.poseInput = document.getElementById('poseInput');
        this.backgroundInput = document.getElementById('backgroundInput');
        this.numPosesInput = document.getElementById('numPoses');
        
        // Camera countdown elements
        this.countdownOverlay = document.getElementById('countdownOverlay');
        this.countdownNumber = document.getElementById('countdownNumber');
        this.currentPoseNumber = document.getElementById('currentPoseNumber');
        this.totalPosesNumber = document.getElementById('totalPosesNumber');
        
        // Camera state
        this.captureTimer = null;
        this.countdownTimer = null;
        this.currentCaptureCount = 0;
        this.targetCaptureCount = 4;
        
        // Settings
        this.toleranceSlider = document.getElementById('tolerance');
        this.qualitySlider = document.getElementById('quality');
        this.spillReductionSlider = document.getElementById('spillReduction');
        this.autoOpenFolderCheck = document.getElementById('autoOpenFolder');
        this.highQualityCheck = document.getElementById('highQuality');
        
        console.log('✅ Elementos inicializados');
    }

    async loadElectronConfig() {
        if (window.electronAPI) {
            try {
                this.config = await window.electronAPI.getConfig();
                
                if (this.config.outputFolder) {
                    this.setOutputFolder(this.config.outputFolder);
                }
                
                if (this.config.settings) {
                    this.settings = { ...this.settings, ...this.config.settings };
                    this.applySettings();
                }
                
                if (this.config.autoOpenFolder !== undefined) {
                    this.autoOpenFolderCheck.checked = this.config.autoOpenFolder;
                }
                
            } catch (error) {
                console.error('Erro ao carregar configurações:', error);
            }
        }
    }

    applySettings() {
        this.toleranceSlider.value = this.settings.tolerance;
        this.qualitySlider.value = this.settings.quality;
        this.spillReductionSlider.value = this.settings.spillReduction || 20;
        
        document.getElementById('toleranceValue').textContent = this.settings.tolerance;
        document.getElementById('qualityValue').textContent = this.settings.quality;
        document.getElementById('spillReductionValue').textContent = this.settings.spillReduction || 20;
    }

    setupEventListeners() {
        // Electron-specific
        if (window.electronAPI) {
            this.selectFolderBtn.addEventListener('click', () => this.selectOutputFolder());
            this.openFolderBtn.addEventListener('click', () => window.electronAPI.openOutputFolder());
            
            window.electronAPI.onOutputFolderChanged((event, folder) => {
                this.setOutputFolder(folder);
            });
            
            window.electronAPI.onSaveProgress((event, progress) => {
                this.updateSaveProgress(progress);
            });
        }
        
        // Camera controls
        this.startCameraBtn.addEventListener('click', () => this.startCamera());
        this.stopCameraBtn.addEventListener('click', () => this.stopCamera());
        
        // Num poses input
        this.numPosesInput.addEventListener('change', () => {
            this.targetCaptureCount = parseInt(this.numPosesInput.value);
            this.totalPosesNumber.textContent = this.targetCaptureCount;
        });
        
        // File inputs
        this.poseInput.addEventListener('change', (e) => this.handlePoseUpload(e));
        this.backgroundInput.addEventListener('change', (e) => this.handleBackgroundUpload(e));
        
        // Actions
        this.clearPosesBtn.addEventListener('click', () => this.clearAllPoses());
        
        // QR Code functionality - AGORA INICIA PROCESSAMENTO!
        this.qrCodeInput.addEventListener('input', (e) => this.validateQRCode(e.target.value));
        this.qrCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.setSessionBtn.disabled) {
                this.confirmAndProcess();
            }
        });
        this.setSessionBtn.addEventListener('click', () => this.confirmAndProcess());
        this.clearSessionBtn.addEventListener('click', () => this.clearSession());
        
        // Settings
        this.toleranceSlider.addEventListener('input', (e) => {
            this.settings.tolerance = parseInt(e.target.value);
            document.getElementById('toleranceValue').textContent = e.target.value;
            this.saveSettings();
        });
        
        this.qualitySlider.addEventListener('input', (e) => {
            this.settings.quality = parseInt(e.target.value);
            document.getElementById('qualityValue').textContent = e.target.value;
            this.saveSettings();
        });
        
        this.spillReductionSlider.addEventListener('input', (e) => {
            this.settings.spillReduction = parseInt(e.target.value);
            document.getElementById('spillReductionValue').textContent = e.target.value;
            this.saveSettings();
        });
        
        this.autoOpenFolderCheck.addEventListener('change', () => this.saveSettings());
        this.highQualityCheck.addEventListener('change', () => this.saveSettings());
        
        console.log('✅ Event listeners configurados');
    }

    async saveSettings() {
        if (window.electronAPI) {
            try {
                await window.electronAPI.saveConfig({
                    chromaSettings: this.settings,
                    autoOpenFolder: this.autoOpenFolderCheck.checked,
                    imageQuality: this.highQualityCheck.checked ? 95 : 80
                });
            } catch (error) {
                console.error('Erro ao salvar configurações:', error);
            }
        }
    }

    // === QR CODE FUNCTIONS ===
    
    validateQRCode(code) {
        // Remove espaços e converte para maiúsculas
        code = code.replace(/\s/g, '').toUpperCase();
        
        // ✅ FORMATO PADRÃO: AAAA-NNNNNNN (4 letras/números + hífen + 7 letras/números)
        const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{7}$/;
        const isValid = pattern.test(code);
        
        if (code.length === 0) {
            this.qrCodeInput.style.borderColor = 'rgba(255,255,255,0.3)';
            this.setSessionBtn.disabled = true;
        } else if (isValid && this.canProcess()) {
            this.qrCodeInput.style.borderColor = '#27ae60';
            this.setSessionBtn.disabled = false;
        } else {
            this.qrCodeInput.style.borderColor = '#e74c3c';
            this.setSessionBtn.disabled = true;
        }
        
        // Auto-format: adicionar hífen após 4 caracteres
        if (code.length === 4 && !code.includes('-')) {
            this.qrCodeInput.value = code + '-';
        } else {
            this.qrCodeInput.value = code;
        }
        
        return isValid;
    }

    canProcess() {
        return this.outputFolder && this.poses.length > 0 && this.backgrounds.length > 0;
    }

    // ✨ NOVA FUNÇÃO: Confirmar código E iniciar processamento automaticamente
    async confirmAndProcess() {
        const code = this.qrCodeInput.value.trim().toUpperCase();
        
        if (!this.validateQRCode(code)) {
            alert('❌ Código inválido!\n\n✅ Use o formato: AAAA-NNNNNNN\n\nExemplos válidos:\n• ABCD-1234567\n• TEST-ABC1234\n• 1234-ABCDEFG');
            return;
        }
        
        if (!this.canProcess()) {
            alert('⚠️ Complete todos os passos antes de confirmar o código:\n\n' +
                  (!this.outputFolder ? '❌ Escolha uma pasta base\n' : '✅ Pasta selecionada\n') +
                  (this.poses.length === 0 ? '❌ Carregue poses\n' : '✅ Poses carregadas\n') +
                  (this.backgrounds.length === 0 ? '❌ Carregue fundos' : '✅ Fundos prontos'));
            return;
        }
        
        // ✅ USA O CÓDIGO EXATO COMO NOME DA PASTA
        this.currentSession = {
            code: code,
            folderName: code,
            timestamp: new Date().toISOString()
        };
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ CÓDIGO CONFIRMADO:', code);
        console.log('📁 NOME DA PASTA:', code);
        console.log('🕐 TIMESTAMP:', this.currentSession.timestamp);
        console.log('🚀 INICIANDO PROCESSAMENTO AUTOMÁTICO...');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        this.updateSessionDisplay();
        
        // Salvar sessão
        if (window.electronAPI) {
            await window.electronAPI.saveConfig({
                currentSession: this.currentSession
            });
        }
        
        // 🚀 INICIAR PROCESSAMENTO AUTOMATICAMENTE!
        await this.startAutoGeneration();
    }

    updateSessionDisplay() {
        if (this.currentSession) {
            this.currentSessionDisplay.className = 'status-box status-success';
            this.currentSessionDisplay.innerHTML = `
                <strong>✅ ${this.currentSession.code}</strong>
                <div style="font-size: 14px; margin-top: 5px;">
                    Processamento em andamento...
                </div>
            `;
            
            this.clearSessionBtn.disabled = false;
            
            // Mostrar caminho da pasta do cliente
            if (this.outputFolder) {
                const sessionPath = `${this.outputFolder}/${this.currentSession.code}`;
                this.sessionFolderPath.textContent = sessionPath;
                this.sessionFolderInfo.style.display = 'block';
            }
        } else {
            this.currentSessionDisplay.className = 'status-box status-warning';
            this.currentSessionDisplay.innerHTML = `
                <strong>⚠️ Aguardando código</strong>
                <div style="font-size: 14px; margin-top: 5px;">
                    Complete os passos acima primeiro
                </div>
            `;
            
            this.clearSessionBtn.disabled = true;
            this.sessionFolderInfo.style.display = 'none';
        }
    }

    clearSession() {
        if (!this.currentSession) return;
        
        const confirmed = confirm(
            `Cancelar processamento do cliente ${this.currentSession.code}?\n\n` +
            `Isso não afetará fotos já salvas.`
        );
        
        if (confirmed) {
            this.currentSession = null;
            this.qrCodeInput.value = '';
            this.qrCodeInput.style.borderColor = 'rgba(255,255,255,0.3)';
            this.setSessionBtn.disabled = !this.canProcess();
            this.updateSessionDisplay();
            this.updateUI();
            
            if (window.electronAPI) {
                window.electronAPI.saveConfig({
                    currentSession: null
                });
            }
            
            console.log('🗑️ Sessão cancelada');
        }
    }

    // === FOLDER FUNCTIONS ===
    
    async selectOutputFolder() {
        if (window.electronAPI) {
            try {
                const folder = await window.electronAPI.selectOutputFolder();
                if (folder) {
                    this.setOutputFolder(folder);
                }
            } catch (error) {
                console.error('Erro ao selecionar pasta:', error);
            }
        }
    }

    setOutputFolder(folder) {
        this.outputFolder = folder;
        this.outputFolderPath.textContent = folder;
        this.outputFolderDisplay.classList.remove('not-selected');
        this.outputFolderDisplay.classList.add('status-success');
        this.openFolderBtn.disabled = false;
        
        this.updateSessionDisplay();
        this.updateUI();
        
        console.log('📁 Pasta base definida:', folder);
    }

    // === CAMERA FUNCTIONS ===
    
    async startCamera() {
        try {
            // Ler quantidade de poses desejada
            this.targetCaptureCount = parseInt(this.numPosesInput.value);
            this.currentCaptureCount = 0;
            
            // Atualizar display
            this.totalPosesNumber.textContent = this.targetCaptureCount;
            this.currentPoseNumber.textContent = '0';
            
            this.cameraSection.classList.remove('hidden');
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            this.video.srcObject = this.stream;
            
            this.startCameraBtn.disabled = true;
            this.stopCameraBtn.disabled = false;
            this.statusText.textContent = '⏳ Preparando captura automática...';
            
            // Aguardar 2 segundos antes de iniciar
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Iniciar sequência de captura automática
            this.startAutomaticCapture();
            
        } catch (error) {
            alert('Erro ao acessar a câmera: ' + error.message);
            this.cameraSection.classList.add('hidden');
        }
    }

    async startAutomaticCapture() {
    this.statusText.textContent = '🎬 Captura automática iniciada!';
    
    const captureLoop = async () => {
        if (this.currentCaptureCount >= this.targetCaptureCount) {
            // Todas as fotos capturadas!
            this.statusText.textContent = `✅ ${this.targetCaptureCount} poses capturadas com sucesso!`;
            await new Promise(resolve => setTimeout(resolve, 2000));
            this.stopCamera();
            return;
        }
        
        // ✨ APENAS NA PRIMEIRA FOTO: Mostrar countdown
        if (this.currentCaptureCount === 0) {
            await this.showCountdown();
        } else {
            // Demais fotos: apenas aviso rápido
            this.statusText.textContent = `📸 Preparar...`;
            await new Promise(resolve => setTimeout(resolve, 300)); // Flash rápido
        }
        
        // Capturar foto
        this.capturePhoto();
        
        // Aguardar antes da próxima foto
        if (this.currentCaptureCount < this.targetCaptureCount) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 segundo
            // Continuar se a câmera ainda estiver ativa
            if (this.stream) {
                captureLoop();
            }
        } else {
            // Última foto capturada
            this.statusText.textContent = `✅ ${this.targetCaptureCount} poses capturadas com sucesso!`;
            await new Promise(resolve => setTimeout(resolve, 2000));
            this.stopCamera();
        }
    };
    
    captureLoop();
}

    async showCountdown() {
        return new Promise((resolve) => {
            this.countdownOverlay.classList.remove('hidden');
            let count = 1;
            
            const updateCountdown = () => {
                if (count > 0) {
                    this.countdownNumber.textContent = count;
                    this.countdownNumber.style.animation = 'none';
                    setTimeout(() => {
                        this.countdownNumber.style.animation = 'pulse 1s ease-in-out';
                    }, 10);
                    count--;
                    setTimeout(updateCountdown, 1000);
                } else {
                    this.countdownOverlay.classList.add('hidden');
                    resolve();
                }
            };
            
            updateCountdown();
        });
    }

    stopCamera() {
        // Limpar timers
        if (this.captureTimer) {
            clearTimeout(this.captureTimer);
            this.captureTimer = null;
        }
        if (this.countdownTimer) {
            clearTimeout(this.countdownTimer);
            this.countdownTimer = null;
        }
        
        // Parar stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.video.srcObject = null;
            this.stream = null;
        }
        
        this.startCameraBtn.disabled = false;
        this.stopCameraBtn.disabled = true;
        this.statusText.textContent = 'Câmera desligada';
        this.cameraSection.classList.add('hidden');
        this.countdownOverlay.classList.add('hidden');
        
        // Reset counters
        this.currentCaptureCount = 0;
        this.currentPoseNumber.textContent = '0';
    }

    capturePhoto() {
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    this.ctx.drawImage(this.video, 0, 0);
    
    // ✅ SALVAR ORIGINAL (foto com fundo verde)
    const originalData = this.canvas.toDataURL('image/png');
    
    this.poses.push({
        id: this.poses.length + 1,
        data: originalData,           // Para processamento
        original: originalData,       // ← NOVO: Original para backup
        source: 'camera'
    });
    
    this.currentCaptureCount++;
    this.currentPoseNumber.textContent = this.currentCaptureCount;
    
    this.updateUI();
    this.statusText.textContent = `📸 Pose ${this.currentCaptureCount}/${this.targetCaptureCount} capturada!`;
    
    console.log(`📸 Pose ${this.currentCaptureCount} capturada (original salvo)`); // ← Log opcional
}

    // === FILE HANDLING ===
    
    handlePoseUpload(event) {
        const files = Array.from(event.target.files);
        
        if (files.length === 0) return;
        
        this.poseStatus.textContent = `Carregando ${files.length} foto(s)...`;
        
        files.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.poses.push({
                    id: this.poses.length + 1,
                    data: e.target.result,
                    source: 'upload',
                    filename: file.name
                });
                
                this.updateUI();
                
                if (index === files.length - 1) {
                    this.poseStatus.textContent = `${files.length} foto(s) carregada(s) com sucesso!`;
                }
            };
            reader.readAsDataURL(file);
        });
        
        event.target.value = '';
    }

    clearAllPoses() {
        if (this.poses.length === 0) return;
        
        const confirmed = confirm(`Limpar todas as ${this.poses.length} poses?`);
        if (confirmed) {
            this.poses = [];
            this.poseStatus.textContent = 'Poses limpas';
            this.updateUI();
        }
    }

    loadDefaultBackgrounds() {
        const defaultBackgrounds = [
        ];

        defaultBackgrounds.forEach(bg => this.createGradientBackground(bg));
    }

    createGradientBackground(bg) {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, bg.gradient[0]);
        gradient.addColorStop(1, bg.gradient[1]);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        this.backgrounds.push({
            id: this.backgrounds.length + 1,
            name: bg.name,
            data: canvas.toDataURL('image/png')
        });
    }

    handleBackgroundUpload(event) {
        const files = Array.from(event.target.files);
        
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.backgrounds.push({
                    id: this.backgrounds.length + 1,
                    name: file.name.replace(/\.[^/.]+$/, ""),
                    data: e.target.result
                });
                this.updateUI();
            };
            reader.readAsDataURL(file);
        });
    }

    // === UI UPDATE ===
    
    updateUI() {
        this.poseCountSpan.textContent = this.poses.length;
        this.backgroundCountSpan.textContent = this.backgrounds.length;
        this.totalCombinations.textContent = this.poses.length * this.backgrounds.length;
        
        // Update checklist
        this.updateChecklist();
        
        // Poses grid
        this.posesGrid.innerHTML = '';
        this.poses.forEach((pose, index) => {
            const poseDiv = document.createElement('div');
            poseDiv.className = 'pose-item';
            
            const sourceIcon = pose.source === 'camera' ? '📸' : '📁';
            
            poseDiv.innerHTML = `
                <img src="${pose.data}" alt="Pose ${pose.id}">
                <div class="pose-number">${sourceIcon} ${pose.id}</div>
            `;
            poseDiv.title = pose.filename || `Pose capturada ${pose.id}`;
            this.posesGrid.appendChild(poseDiv);
        });
        
        // Backgrounds grid
        this.backgroundsGrid.innerHTML = '';
        this.backgrounds.forEach(bg => {
            const bgDiv = document.createElement('div');
            bgDiv.className = 'background-item';
            bgDiv.innerHTML = `<img src="${bg.data}" alt="${bg.name}" title="${bg.name}">`;
            this.backgroundsGrid.appendChild(bgDiv);
        });
        
        // Habilitar botão de confirmar código apenas se tudo estiver pronto
        const code = this.qrCodeInput.value.trim();
        if (code) {
            this.validateQRCode(code);
        } else {
            this.setSessionBtn.disabled = !this.canProcess();
        }
        
        this.clearPosesBtn.disabled = this.poses.length === 0;
        
        if (this.poses.length > 0 && this.poseStatus.textContent.includes('Carregue')) {
            this.poseStatus.textContent = `${this.poses.length} pose(s) pronta(s)`;
        }
    }

    updateChecklist() {
        // Atualizar checklist visual
        this.updateChecklistItem(this.checkFolder, !!this.outputFolder, 'Pasta Base Selecionada');
        this.updateChecklistItem(this.checkPoses, this.poses.length > 0, 'Poses Carregadas');
        this.updateChecklistItem(this.checkBackgrounds, this.backgrounds.length > 0, 'Fundos Disponíveis');
    }

    updateChecklistItem(element, isComplete, text) {
        if (isComplete) {
            element.className = 'checklist-item complete';
            element.querySelector('.checklist-icon').textContent = '✅';
        } else {
            element.className = 'checklist-item incomplete';
            element.querySelector('.checklist-icon').textContent = '❌';
        }
    }

    // === PROCESSING ===
    
    async startAutoGeneration() {
        if (!this.currentSession) {
            alert('⚠️ Erro interno: sessão não definida');
            return;
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 INICIANDO PROCESSAMENTO');
        console.log('📁 Pasta base:', this.outputFolder);
        console.log('🎫 Código do cliente:', this.currentSession.code);
        console.log('📂 Nome da pasta destino:', this.currentSession.folderName);
        console.log('📸 Total de poses:', this.poses.length);
        console.log('🎨 Total de fundos:', this.backgrounds.length);
        console.log('🖼️ Total de imagens:', this.poses.length * this.backgrounds.length);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        this.processingOverlay.style.display = 'flex';
        this.processingSection.classList.remove('hidden');
        this.folderInfo.classList.add('hidden');
        
        // Desabilitar inputs durante processamento
        this.qrCodeInput.disabled = true;
        this.setSessionBtn.disabled = true;
        
        const totalImages = this.poses.length * this.backgrounds.length;
        let processedImages = 0;
        const allResults = [];
        
        try {
            this.processingTitle.textContent = `Processando Cliente ${this.currentSession.code}`;
            this.processingStatus.textContent = 'Removendo fundos verdes e aplicando fundos';
            this.updateProgress(0, 'Iniciando processamento...');
            
            // Process all images
            for (let poseIndex = 0; poseIndex < this.poses.length; poseIndex++) {
                for (let bgIndex = 0; bgIndex < this.backgrounds.length; bgIndex++) {
                    const result = await this.processImage(
                        this.poses[poseIndex],
                        this.backgrounds[bgIndex]
                    );
                    
                    allResults.push(result);
                    processedImages++;
                    
                    const progress = (processedImages / totalImages) * 100;
                    this.updateProgress(progress, `Processando ${processedImages}/${totalImages}...`);
                    this.processingDetails.textContent = `Pose ${this.poses[poseIndex].id} + ${this.backgrounds[bgIndex].name}`;
                    
                    await new Promise(resolve => setTimeout(resolve, 30));
                }
            }
            
            // Save all images
            this.processingTitle.textContent = `Salvando Fotos do Cliente ${this.currentSession.code}`;
            this.processingStatus.textContent = 'Salvando na pasta do cliente';
            this.processingDetails.textContent = `Pasta: ${this.currentSession.folderName}`;
            
            console.log('💾 Enviando para salvar:', {
                totalImagens: allResults.length,
                sessionCode: this.currentSession.code,
                sessionFolder: this.currentSession.folderName
            });
            
            const saveResult = await window.electronAPI.saveImagesBatch(allResults, {
                sessionCode: this.currentSession.code,
                sessionFolder: this.currentSession.folderName
            });
            
            console.log('✅ Resultado do salvamento:', saveResult);
            
            this.showCompletionMessage(saveResult);
            
        } catch (error) {
            console.error('❌ ERRO NO PROCESSAMENTO:', error);
            alert('Erro no processamento: ' + error.message);
            
            // Re-habilitar inputs
            this.qrCodeInput.disabled = false;
            this.setSessionBtn.disabled = false;
        } finally {
            this.processingOverlay.style.display = 'none';
        }
    }

    updateSaveProgress(progress) {
        this.processingDetails.textContent = `Salvando: ${progress.filename}`;
    }

    async processImage(pose, background) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const poseImg = new Image();
        const bgImg = new Image();
        
        let loadedCount = 0;
        const checkLoaded = () => {
            loadedCount++;
            if (loadedCount === 2) {
                canvas.width = Math.max(poseImg.width, bgImg.width);
                canvas.height = Math.max(poseImg.height, bgImg.height);
                
                // Draw background
                ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
                
                // Apply chroma key
                this.applyAdvancedChromaKey(ctx, poseImg, canvas.width, canvas.height);
                
                // Nome do arquivo SEM o código QR
                const poseDesc = pose.filename ? 
                    pose.filename.replace(/\.[^/.]+$/, "").substring(0, 30) : 
                    `Pose_${pose.id}`;
                const bgDesc = background.name.replace(/[^a-zA-Z0-9]/g, '_');
                
                resolve({
                    filename: `${poseDesc}_${bgDesc}.png`,
                    data: canvas.toDataURL('image/png'),
                    originalData: pose.original,  // ✅ ADICIONAR ESTA LINHA
                    poseId: pose.id
                });
            }
        };
        
        poseImg.onload = checkLoaded;
        bgImg.onload = checkLoaded;
        poseImg.src = pose.data;
        bgImg.src = background.data;
    });
}

    applyAdvancedChromaKey(ctx, sourceImg, width, height) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = sourceImg.width;
        tempCanvas.height = sourceImg.height;
        
        tempCtx.drawImage(sourceImg, 0, 0);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;
        
        const tolerance = this.settings.tolerance / 100;
        const smoothness = this.settings.quality / 100;
        const spillReduction = this.settings.spillReduction / 100;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Advanced green detection
            const greenness = (g - Math.max(r, b)) / 255;
            const isGreen = greenness > tolerance;
            
            if (isGreen) {
                const alpha = Math.max(0, 1 - (greenness - tolerance) / smoothness);
                data[i + 3] = Math.floor(data[i + 3] * alpha);
            } else if (spillReduction > 0) {
                // Spill reduction
                const spillAmount = Math.max(0, greenness - 0.1) * spillReduction;
                data[i + 1] = Math.max(0, g - spillAmount * 255);
            }
        }
        
        tempCtx.putImageData(imageData, 0, 0);
        
        // Scale and center
        const scale = Math.min(width / tempCanvas.width, height / tempCanvas.height);
        const newWidth = tempCanvas.width * scale;
        const newHeight = tempCanvas.height * scale;
        const x = (width - newWidth) / 2;
        const y = (height - newHeight) / 2;
        
        ctx.drawImage(tempCanvas, x, y, newWidth, newHeight);
    }

    updateProgress(percentage, text) {
        this.progressFill.style.width = percentage + '%';
        this.progressText.textContent = text;
    }

    showCompletionMessage(saveResult) {
        this.progressSection.classList.add('hidden');
        this.completionMessage.innerHTML = `
            <strong>✅ Cliente ${this.currentSession.code} Concluído!</strong><br>
            ${saveResult.count} fotos processadas e salvas<br>
            <strong style="color: #2ecc71;">📁 ${saveResult.folder}</strong><br>
            <small>Cliente pode buscar as fotos usando o código <strong>${this.currentSession.code}</strong></small><br>
            <small style="margin-top: 8px; display: block;">📂 Pasta aberta automaticamente</small>
        `;
        this.folderInfo.classList.remove('hidden');
        
        // Re-habilitar inputs
        this.qrCodeInput.disabled = false;
        this.qrCodeInput.value = '';
        this.qrCodeInput.style.borderColor = 'rgba(255,255,255,0.3)';
        this.setSessionBtn.disabled = false;
        
        // Limpar sessão atual
        this.currentSession = null;
        this.updateSessionDisplay();
        
        // Opcional: limpar poses após completar
        setTimeout(() => {
            const clearPoses = confirm(`Fotos prontas!\n\nDeseja limpar as poses para atender o próximo cliente?`);
            if (clearPoses) {
                this.poses = [];
                this.updateUI();
            }
        }, 2000);
    }
}

// Initialize the desktop application
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎬 Green Screen Studio Desktop iniciando...');
    new DesktopGreenScreenStudio();
});