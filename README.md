# 🎬 Green Screen Studio Desktop

Aplicação desktop profissional para remoção automática de fundo verde com **zero interação** e salvamento automático.

## ✨ Características Principais

- 🚀 **Zero Interação**: Configure uma vez, processe automaticamente
- 📁 **Salvamento Automático**: Salva diretamente na pasta escolhida sem perguntar
- 🎛️ **Parâmetros Configuráveis**: Controle total sobre a remoção de chroma key
- 📸 **Múltiplas Entradas**: Upload de fotos ou captura ao vivo
- 🖼️ **Fundos Personalizados**: Adicione quantos fundos quiser
- ⚡ **Processamento em Lote**: Gera todas as combinações automaticamente
- 💾 **Configurações Persistentes**: Suas configurações são salvas automaticamente

## 🔧 Instalação

### Pré-requisitos
- Node.js 16+ instalado
- NPM ou Yarn

### Passo a Passo

1. **Baixar e extrair os arquivos**
```bash
# Criar pasta do projeto
mkdir green-screen-studio-desktop
cd green-screen-studio-desktop
```

2. **Copiar os arquivos fornecidos:**
- `package.json`
- `main.js`
- `preload.js`
- `index.html`

3. **Instalar dependências**
```bash
npm install
```

4. **Executar em modo desenvolvimento**
```bash
npm start
```

5. **Gerar executáveis para distribuição**
```bash
# Windows
npm run build-win

# macOS
npm run build-mac

# Linux
npm run build-linux

# Todos os sistemas
npm run dist
```

## 📂 Estrutura dos Arquivos

```
green-screen-studio-desktop/
├── package.json          # Configurações do projeto
├── main.js               # Processo principal Electron
├── preload.js            # Bridge segura
├── index.html            # Interface da aplicação
├── assets/               # Ícones (opcional)
│   ├── icon.png
│   ├── icon.ico
│   └── icon.icns
└── dist/                 # Executáveis gerados
    ├── Green Screen Studio Setup.exe
    ├── Green Screen Studio.dmg
    └── Green Screen Studio.AppImage
```

## 🎯 Como Usar

### Configuração Inicial

1. **Primeira Execução**
   - Abra a aplicação
   - Clique em "Escolher Pasta" para definir onde salvar as imagens
   - Ajuste os parâmetros de remoção se necessário

2. **Carregar Poses**
   - Use "Selecionar Fotos" para carregar múltiplas imagens com fundo verde
   - OU use "Iniciar Câmera" para capturar poses ao vivo

3. **Adicionar Fundos (Opcional)**
   - A aplicação já vem com 4 fundos padrão
   - Use "Carregar Fundos" para adicionar seus próprios

4. **Processamento Automático**
   - Clique "PROCESSAR E SALVAR AUTOMATICAMENTE"
   - A aplicação irá processar tudo e salvar na pasta escolhida
   - **Zero interação necessária!**

### Parâmetros Configuráveis

| Parâmetro | Descrição | Valor Recomendado |
|-----------|-----------|-------------------|
| **Sensibilidade Verde** | O quão sensível é a detecção de verde | 35 (padrão) |
| **Suavização de Bordas** | Suaviza as bordas da remoção | 8 (padrão) |
| **Redução de Vazamento** | Remove reflexos verdes no objeto | 20 (padrão) |
| **Abrir pasta após processar** | Abre automaticamente a pasta com resultados | ✅ Ativado |
| **Qualidade máxima** | Salva com qualidade máxima de imagem | ✅ Ativado |

## 📁 Organização dos Arquivos Salvos

A aplicação cria automaticamente uma pasta para cada sessão:

```
Pasta Escolhida/
└── GreenScreen_2024-12-07_14-30-15/
    ├── Pose_1_Ceu_Azul.png
    ├── Pose_1_Por_do_Sol.png
    ├── Pose_1_Floresta.png
    ├── Pose_1_Noturno.png
    ├── Pose_2_Ceu_Azul.png
    └── ... (todas as combinações)
```

## ⚙️ Configurações Avançadas

### Arquivo de Configuração
As configurações são salvas automaticamente em:
- **Windows**: `%APPDATA%/green-screen-studio-desktop/config.json`
- **macOS**: `~/Library/Application Support/green-screen-studio-desktop/config.json`
- **Linux**: `~/.config/green-screen-studio-desktop/config.json`

### Configurações Disponíveis
```json
{
  "outputFolder": "/caminho/para/pasta",
  "autoSave": true,
  "chromaSettings": {
    "tolerance": 35,
    "quality": 8,
    "spillReduction": 20
  },
  "autoOpenFolder": true,
  "imageFormat": "png",
  "imageQuality": 95
}
```

## 🚀 Uso Profissional

### Fluxo de Trabalho Otimizado

1. **Configurar uma vez**:
   - Definir pasta de destino
   - Ajustar parâmetros para seu setup
   - Adicionar fundos personalizados

2. **Uso diário**:
   - Carregar fotos com fundo verde
   - Clicar "Processar"
   - Aguardar salvamento automático
   - **Pronto para usar!**

### Dicas para Melhores Resultados

- 🎯 **Iluminação uniforme** no fundo verde
- 📏 **Distância adequada** entre pessoa e fundo (1-2 metros)
- 🎨 **Evitar roupas verdes** ou objetos com reflexos verdes
- 📐 **Fundo bem esticado** sem dobras ou sombras

## 🔧 Personalização e Scripts

### Build Customizado
Para personalizar o instalador, edite `package.json`:

```json
{
  "build": {
    "appId": "com.suaempresa.greenstudio",
    "productName": "Seu Green Studio",
    "win": {
      "icon": "assets/seu-icon.ico"
    }
  }
}
```

### Scripts Úteis
```bash
# Desenvolvimento com hot reload
npm run dev

# Build apenas Windows
npm run build-win

# Limpar builds anteriores
rm -rf dist/

# Verificar estrutura do app
npm run start
```

## 📞 Suporte e Solução de Problemas

### Problemas Comuns

**Erro de câmera não encontrada:**
- Verifique se a câmera está conectada
- Dê permissão para a aplicação usar a câmera

**Qualidade de remoção ruim:**
- Ajuste a "Sensibilidade Verde" (mais baixo = mais conservador)
- Aumente a "Suavização de Bordas" para bordas mais suaves
- Use "Redução de Vazamento" para remover reflexos verdes

**Arquivos não salvando:**
- Verifique se tem permissão de escrita na pasta escolhida
- Confirme que há espaço em disco suficiente

### Logs de Debug
Para ver logs detalhados:
```bash
npm run dev
```
Abra o Developer Tools com F12

## 📄 Licença

MIT License - Use livremente para projetos comerciais e pessoais.

## 🎉 Contribuição

Contribuições são bem-vindas! Para melhorias:

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

---

**Desenvolvido para uso profissional - Zero interação, máxima produtividade!** 🚀