import { app, BrowserWindow, Menu } from 'electron';
import * as path from 'path';
import { AudioManager } from './audio-manager';
import { initializeLLMSettingsHandlers } from './llm-settings-handlers';

let mainWindow: BrowserWindow | null = null;
let audioManager: AudioManager | null = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    show: false,
    backgroundColor: '#f8fafc',
    vibrancy: 'under-window',
    visualEffectState: 'active',
  });

  // 開発環境ではローカルサーバー、本番環境ではファイルを読み込み
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    audioManager = null;
  });
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'ファイル',
      submenu: [
        {
          label: '終了',
          accelerator: 'Cmd+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: '開発',
      submenu: [
        {
          label: '開発者ツール',
          accelerator: 'Cmd+Option+I',
          click: () => {
            mainWindow?.webContents.toggleDevTools();
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
  createMenu();

  // AudioManagerを初期化（mainWindowを渡す）
  if (mainWindow) {
    audioManager = new AudioManager(mainWindow);
  }

  // LLM設定ハンドラーを初期化
  initializeLLMSettingsHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      if (mainWindow) {
        audioManager = new AudioManager(mainWindow);
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
