import { app, BrowserWindow, autoUpdater } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import isDev from 'electron-is-dev'
import { execFile, exec } from 'child_process'
import http from 'http'
import https from 'https'
import process, { stderr } from 'process';
import { shell } from 'electron'
import net from 'net';

// auto update settings
const server = "https://fi-q.vercel.app"
let url = `${server}/update/${process.platform}/${app.getVersion()}`
if (process.platform === 'darwin') {
  url = `${server}/update/dmg/${app.getVersion()}`
  console.log(url)
}
setInterval(() => {
  autoUpdater.checkForUpdates()
}, 60000 * 60 * 8) // check for updates every 8 hours

autoUpdater.setFeedURL({ url })

autoUpdater.on('update-available', () => {
  console.log('Update available. Downloading...')
})

autoUpdater.on('update-not-available', () => {
  console.log('Update not available.')
})

autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
  const dialogOpts = {
    type: 'info',
    buttons: ['Restart', 'Later'],
    title: 'Application Update',
    message: process.platform === 'win32' ? releaseNotes : releaseName,
    detail:
      'A new version was downloaded. Please restart the application to apply the updates.'
  }

  dialog.showMessageBox(dialogOpts).then((returnValue) => {
    if (returnValue.response === 0) autoUpdater.quitAndInstall()
  })
})

// MAS builds wrap fi-q-server in a .app bundle; dmg builds use the direct binary
const API_PROD_BUNDLE = join(process.resourcesPath, 'lib/fi-q-server/fi-q-server.app/Contents/MacOS/fi-q-server')
const API_PROD_DIRECT = join(process.resourcesPath, 'lib/fi-q-server/fi-q-server')
const API_PROD_PATH = existsSync(API_PROD_BUNDLE) ? API_PROD_BUNDLE : API_PROD_DIRECT
const API_DEV_PATH = join(process.cwd(), './server/dist/fi-q-server/fi-q-server')
// const INDEX_PATH = join(process.cwd(), '../server/static/index.html')
const app_instance = app.requestSingleInstanceLock()

let apiProcess = null

// Start Fi-Q API server
if (isDev) {
  console.log('Starting Fi Q server (development)...')

  // check if development server port is running on port 8000
  function isPortInUse(port) {
    return new Promise((resolve) => {
      const cmd =
        process.platform === 'win32'
          ? `netstat -ano | findstr :${port}`
          : `lsof -iTCP:${port} -sTCP:LISTEN`

      exec(cmd, (err, stdout) => {
        if (stdout && stdout.trim().length > 0) {
          // console.log(`Port ${port} is in use`)
          resolve(true)
        } else {
          // console.log(`Port ${port} is available`)
          resolve(false)
        }
      })
    })
  }

  ; (async () => {
    const PORT = 8000

    try {
      const portInUse = await isPortInUse(PORT);
      // console.log('Port in use:', portInUse);
      if (portInUse) {
        console.log(`Port ${PORT} already in use — server not started`)
        return
      }
      console.log('Starting API process...');
      apiProcess = execFile(
        API_DEV_PATH,
        [],
        {
          windowsHide: false
        },
        (err) => {
          if (err) {
            console.error('API process failed:', err)
          }
        }
      )
    } catch (err) {
      console.error("Fi Q server may not be built for the current OS. Repackage and try again.", err)
    }
  })()
  // apiProcess = execFile(API_DEV_PATH, { windowsHide: false }, (err, stdout, stderr) => {
  //   if(err){ throw err }
  // })
  // console.log(JSON.stringify(apiProcess))
} else {
  console.log(`Starting Fi Q server (production)... ${API_PROD_PATH}`)
  apiProcess = execFile(API_PROD_PATH, { windowsHide: false })
}

// Poll until localhost:8000 is up
function waitForServer(url, timeout = 60000, interval = 500) {
  const start = Date.now()
  const client = url.startsWith('https') ? https : http
  const options = url.startsWith('https') ? { rejectUnauthorized: false } : {}
  return new Promise((resolve, reject) => {
    const check = () => {
      client
        .get(url, options, res => {
          if (res.statusCode === 200) resolve()
          else if (Date.now() - start > timeout) reject(new Error('Timeout waiting for server'))
          else setTimeout(check, interval)
        })
        .on('error', () => {
          if (Date.now() - start > timeout) reject(new Error('Timeout waiting for server'))
          else setTimeout(check, interval)
        })
    }
    check()
  })
}

let splash;

// Create splash screen
function createSplash() {
  // let __dirname = process.cwd();
  const splashWindow = new BrowserWindow({
    // titleBarStyle: 'hidden',
    width: 500,
    height: 300,
    transparent: true,
    frame: false,
    // minimizable: false,
    // maximizable: false,
    // closable: false,
  })
  // splashWindow.loadURL(`file://${__dirname}/splash.html`);
  splashWindow.loadFile('app/splash.html')
  return splashWindow;
}

// Create main window
function createWindow() {
  const mainWindow = new BrowserWindow({ show: false })

  // https://stackoverflow.com/a/67108615
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // config.fileProtocol is my custom file protocol
    // if (url.startsWith(config.fileProtocol)) {
    //     return { action: 'allow' };
    // }
    // open url in a browser and prevent default
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // mainWindow.maximize()
  mainWindow.loadURL('https://localhost:8000')

  mainWindow.once('ready-to-show', () => {
    splash.destroy();
    mainWindow.maximize()
    mainWindow.show();
  });

  if (!app_instance) {
    app.quit()
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
    })
  }

  // Check for updates  
  try {
    autoUpdater.checkForUpdates()
  } catch (err) {
    console.error('Failed to check for updates:', err)
  }
}

// Wait for Electron ready and server startup
app.whenReady().then(async () => {
  try {
    splash = createSplash();
    console.log('Waiting for Fi Q server on https://localhost:8000...')
    await waitForServer('https://localhost:8000')
    console.log('Fi Q server is ready.')
    createWindow()
  } catch (err) {
    console.error('Failed to connect to Fi Q server:', err)
    app.quit()
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// allow self-signed certificates for localhost:8000
app.on("certificate-error", (event, webContents, url, error, cert, callback) => {
  // Do some verification based on the URL to not allow potentially malicious certs:
  if (url.startsWith("https://localhost:8000")) {
    // Hint: For more security, you may actually perform some checks against
    // the passed certificate (parameter "cert") right here

    event.preventDefault(); // Stop Chromium from rejecting the certificate
    callback(true);         // Trust this certificate
  } else callback(false);     // Let Chromium do its thing
});

// Clean shutdown
app.on('before-quit', function () {
  if (apiProcess) apiProcess.kill('SIGINT')
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

