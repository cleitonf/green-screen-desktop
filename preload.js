const { contextBridge, ipcRenderer } = require('electron');

// API segura exposta para o renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // Configurações
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    
    // Gerenciamento de arquivos
    selectOutputFolder: () => ipcRenderer.invoke('select-output-folder'),
    
    saveImagesBatch: (results, session) => {
    console.log('🔗 Preload - sessionFolder:', session?.sessionFolder);
    return ipcRenderer.invoke('save-images-batch', results, session);
},
    
    openOutputFolder: () => ipcRenderer.invoke('open-output-folder'),
    
    // Event listeners
    onConfigLoaded: (callback) => ipcRenderer.on('config-loaded', callback),
    onOutputFolderChanged: (callback) => ipcRenderer.on('output-folder-changed', callback),
    onSaveProgress: (callback) => ipcRenderer.on('save-progress', callback),
    onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
    
    // Utilitários
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    
    // Informações do sistema
    platform: process.platform,
    isElectron: true
});

console.log('✅ Preload script carregado - electronAPI disponível');