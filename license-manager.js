/**
 * SISTEMA DE LICENCIAMENTO E ATIVAÇÃO
 * Gerencia validação de licenças, hardware ID e comunicação com API
 */

const crypto = require('crypto');
const os = require('os');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch'); 

class LicenseManager {
    constructor() {
        this.apiUrl = 'https://greenscreen-api.vercel.app/api'; 
        this.licenseFile = path.join(os.homedir(), '.greenscreen-license');
        this.appVersion = '1.0.0';
    }

    /**
     * Verifica se o app está ativado
     */
    async isActivated() {
        try {
            const licenseData = await this.readLicense();
            if (!licenseData) return false;

            // Verificar se a licença é válida
            const isValid = await this.validateLicense(licenseData);
            return isValid;
        } catch (error) {
            console.error('Erro ao verificar ativação:', error);
            return false;
        }
    }

    /**
     * Gera Hardware ID único do computador
     * Usa: Mac Address + Serial da CPU + Serial da Placa-mãe
     */
    async getHardwareId() {
        try {
            const networkInterfaces = os.networkInterfaces();
            const macAddresses = [];
            
            for (const name of Object.keys(networkInterfaces)) {
                for (const net of networkInterfaces[name]) {
                    if (net.mac && net.mac !== '00:00:00:00:00:00') {
                        macAddresses.push(net.mac);
                    }
                }
            }

            let cpuSerial = '';
            let boardSerial = '';

            // Windows
            if (process.platform === 'win32') {
                cpuSerial = await this.execCommand('wmic cpu get processorid');
                boardSerial = await this.execCommand('wmic baseboard get serialnumber');
            }
            // macOS
            else if (process.platform === 'darwin') {
                cpuSerial = await this.execCommand('ioreg -l | grep IOPlatformSerialNumber');
                boardSerial = await this.execCommand('system_profiler SPHardwareDataType | grep Serial');
            }
            // Linux
            else if (process.platform === 'linux') {
                try {
                    cpuSerial = await this.execCommand('cat /proc/cpuinfo | grep Serial');
                } catch (e) {
                    cpuSerial = '';
                }
            }

            // Combinar tudo e criar hash único
            const combined = [
                macAddresses[0] || '',
                cpuSerial.trim(),
                boardSerial.trim(),
                os.hostname()
            ].join('|');

            const hash = crypto.createHash('sha256').update(combined).digest('hex');
            return hash.substring(0, 32); // 32 caracteres

        } catch (error) {
            console.error('Erro ao gerar Hardware ID:', error);
            // Fallback para identificador menos seguro mas funcional
            const fallback = crypto.createHash('sha256')
                .update(os.hostname() + os.platform() + os.arch())
                .digest('hex');
            return fallback.substring(0, 32);
        }
    }

    /**
     * Executa comando do sistema
     */
    execCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout);
            });
        });
    }

    /**
     * Ativa o software com uma chave de licença
     */
    async activate(licenseKey) {
        try {
            // Validar formato da chave
            if (!this.validateKeyFormat(licenseKey)) {
                return {
                    success: false,
                    error: 'Formato de chave inválido'
                };
            }

            // Obter Hardware ID
            const hardwareId = await this.getHardwareId();

            // Fazer requisição para API
            const response = await fetch(`${this.apiUrl}/activate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    license_key: licenseKey,
                    hardware_id: hardwareId,
                    app_version: this.appVersion,
                    platform: process.platform,
                    hostname: os.hostname()
                })
            });

            const data = await response.json();

            if (data.success) {
                // Salvar licença localmente
                await this.saveLicense({
                    license_key: licenseKey,
                    hardware_id: hardwareId,
                    activation_token: data.token,
                    activated_at: new Date().toISOString(),
                    license_type: data.license_type || 'standard',
                    expires_at: data.expires_at || null
                });

                return {
                    success: true,
                    message: 'Ativação realizada com sucesso!'
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Erro ao ativar licença'
                };
            }

        } catch (error) {
            console.error('Erro na ativação:', error);
            return {
                success: false,
                error: 'Erro de conexão com o servidor. Verifique sua internet.'
            };
        }
    }

    /**
     * Valida formato da chave (XXXX-XXXX-XXXX-XXXX)
     */
    validateKeyFormat(key) {
        const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
        return pattern.test(key.toUpperCase());
    }

    /**
     * Salva licença localmente
     */
    async saveLicense(licenseData) {
        try {
            // Criptografar dados antes de salvar
            const encrypted = this.encrypt(JSON.stringify(licenseData));
            await fs.writeFile(this.licenseFile, encrypted, 'utf8');
            console.log('✅ Licença salva com sucesso');
        } catch (error) {
            console.error('Erro ao salvar licença:', error);
            throw error;
        }
    }

    /**
     * Lê licença salva
     */
    async readLicense() {
        try {
            const encrypted = await fs.readFile(this.licenseFile, 'utf8');
            const decrypted = this.decrypt(encrypted);
            return JSON.parse(decrypted);
        } catch (error) {
            return null;
        }
    }

    /**
     * Valida licença localmente e com servidor
     */
    async validateLicense(licenseData) {
        try {
            // Validar Hardware ID
            const currentHardwareId = await this.getHardwareId();
            if (licenseData.hardware_id !== currentHardwareId) {
                console.error('❌ Hardware ID não corresponde');
                return false;
            }

            // Verificar expiração (se houver)
            if (licenseData.expires_at) {
                const expiryDate = new Date(licenseData.expires_at);
                if (expiryDate < new Date()) {
                    console.error('❌ Licença expirada');
                    return false;
                }
            }

            // Validar com servidor (a cada 7 dias)
            const shouldValidateOnline = await this.shouldValidateOnline(licenseData);
            if (shouldValidateOnline) {
                const onlineValid = await this.validateOnline(licenseData);
                if (!onlineValid) {
                    return false;
                }
                // Atualizar data da última validação
                licenseData.last_validated = new Date().toISOString();
                await this.saveLicense(licenseData);
            }

            return true;

        } catch (error) {
            console.error('Erro ao validar licença:', error);
            return false;
        }
    }

    /**
     * Verifica se deve validar online (a cada 7 dias)
     */
    async shouldValidateOnline(licenseData) {
        if (!licenseData.last_validated) return true;
        
        const lastValidated = new Date(licenseData.last_validated);
        const daysSinceValidation = (new Date() - lastValidated) / (1000 * 60 * 60 * 24);
        
        return daysSinceValidation > 7;
    }

    /**
     * Valida licença online com servidor
     */
    async validateOnline(licenseData) {
        try {
            const response = await fetch(`${this.apiUrl}/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    license_key: licenseData.license_key,
                    hardware_id: licenseData.hardware_id,
                    activation_token: licenseData.activation_token
                })
            });

            const data = await response.json();
            return data.valid === true;

        } catch (error) {
            console.error('Erro ao validar online:', error);
            // Se houver erro de rede, permite continuar (validação offline)
            return true;
        }
    }

    /**
     * Desativa/remove licença
     */
    async deactivate() {
        try {
            const licenseData = await this.readLicense();
            if (licenseData) {
                // Notificar servidor sobre desativação
                await fetch(`${this.apiUrl}/deactivate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        license_key: licenseData.license_key,
                        hardware_id: licenseData.hardware_id
                    })
                });
            }

            // Remover arquivo local
            await fs.unlink(this.licenseFile);
            return true;

        } catch (error) {
            console.error('Erro ao desativar:', error);
            return false;
        }
    }

    /**
     * Obtém informações da licença
     */
    async getLicenseInfo() {
        const licenseData = await this.readLicense();
        if (!licenseData) return null;

        return {
            license_key: this.maskLicenseKey(licenseData.license_key),
            activated_at: licenseData.activated_at,
            license_type: licenseData.license_type,
            expires_at: licenseData.expires_at,
            hardware_id: licenseData.hardware_id.substring(0, 8) + '...'
        };
    }

    /**
     * Mascara chave de licença (XXXX-XXXX-XXXX-1234)
     */
    maskLicenseKey(key) {
        const parts = key.split('-');
        return `${parts[0]}-****-****-${parts[3]}`;
    }

    /**
     * Criptografia simples (usar crypto mais robusto em produção)
     */
    encrypt(text) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync('greenscreen-secret-key-2024', 'salt', 32);
        const iv = Buffer.alloc(16, 0);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    decrypt(encrypted) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync('greenscreen-secret-key-2024', 'salt', 32);
        const iv = Buffer.alloc(16, 0);
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}

module.exports = LicenseManager;