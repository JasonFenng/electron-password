## quick-start

### 全局依赖

| dependency | version  |
| ---------- | -------- |
| nodejs     | v12.18.1 |

### 项目依赖

1. 设置安装 electron 时使用淘宝镜像
   ```shell script
   npm config set ELECTRON_MIRROR http://npm.taobao.org/mirrors/electron/
   ```
2. 设置 puppeteer 使用淘宝镜像
   ```shell script
   npm config set puppeteer_download_host=https://npm.taobao.org/mirrors
   ```
3. 整体安装依赖
   ```shell script
   npm i --registry=https://registry.npm.taobao.org
   ```

### quick-start

1. development

```shell script
npm run start
```

2. build
```
npm run pack:mac
npm run pack:win
```

### 基础术语

1. 主进程(main process) & 渲染进程(render process);
   electron 只有一个主进程和多个渲染进程：主进程可以理解为就是 main.js，它来调度 app 窗口，监听 app 事件；渲染进程可以理解为每一个 html，每个 html 被渲染后其实就是创建了一个渲染进程，在渲染进程中的所有操作遵循 web
   开发规范；
2. ipc 通信
   进程之间的通信模式主要是 ipc 通信；这其实包含了两个方面：① 主进程和渲染进程之间的通信；② 多个渲染进程之间的通信；
3. native api
   electron 集成了原生 GUI 及底层能力

| 原生 GUI                                        | 底层能力                  | 底层能力              |
| ----------------------------------------------- | ------------------------- | --------------------- |
| BrowserWindow 应用窗口                          | clipboard 剪切板          | appleScript(macOs)    |
| Tray 托盘(桌面顶部的 logo，windows 底部的 logo) | globalShortcut 全局快捷键 | USB, 蓝牙, 预览文件等 |
| app 设置 dock.badge (设置未读数)                | desktopCapture 捕获桌面   |
| Menu 菜单 (顶部菜单、右键菜单)                  | shell 打开文件、URL       |

### 安全

1. 在安全方面，electron 推荐我们要声明 html 的[Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy), 如果没有设置控制台会报 warning；
2. electron 推荐的做法是不开启 nodeIntegration，其主要考虑的情况是在加载第三方 html 的时候(对于 electron 来讲这算是一个渲染进程)，如果渲染进程中可以借助 electron 改版系统设置、访问设备文件、进行 ipc 通信，那么这对用户来讲是极其危险的事情，所以推荐不开启 nodeIntegration
3. 然而，如果确保 app 中所有的渲染进程都是本地的也就是说不加载第三方 html，那么开启 nodeIntegration 的问题也不大  
   如果使用了这种模式，需要 preload 做桥接，借用了 windows.postMessage 做事件的转发[communication with disabled nodeIntegration](https://stackoverflow.com/questions/52236641/electron-ipc-and-nodeintegration) ，非常繁琐，且事件混乱，在尝试后不再采用。

   ```

           +-----------------+
           |                 | ( app event listener )
           | AppMainPprocess | ( create window )
           |                 |
           +-----------------+
                   ^  |
                   |  |
                ipcRenderer
                   |  |
                   |  v
           +-----------------+
           |                 | ( add variable to window )
           |    preload.js   | ( construct communicate bridge )
           |                 | ( ipc and postMessage covered to each other )
           +-----------------+
                  ^  |
                  |  |
             window.postMessage
                  |  |
                  |  v
           +-----------------+
           | renderProcess   | (like browser)
           +-----------------+
   ```

## icon

### mac icns 制作方法

1. 准备一个 1024 \* 1024 的 png 图片，假设名字为 pic.png
2. 命令行 `$ mkdir tmp.iconset`，创建一个临时目录存放不同大小的图片
3. 把原图片转为不同大小的图片，并放入上面的临时目录

```shell script
# 全部拷贝到命令行回车执行，执行结束之后去tmp.iconset查看十张图片是否生成好
sips -z 16 16     pic.png --out tmp.iconset/icon_16x16.png
sips -z 32 32     pic.png --out tmp.iconset/icon_16x16@2x.png
sips -z 32 32     pic.png --out tmp.iconset/icon_32x32.png
sips -z 64 64     pic.png --out tmp.iconset/icon_32x32@2x.png
sips -z 128 128   pic.png --out tmp.iconset/icon_128x128.png
sips -z 256 256   pic.png --out tmp.iconset/icon_128x128@2x.png
sips -z 256 256   pic.png --out tmp.iconset/icon_256x256.png
sips -z 512 512   pic.png --out tmp.iconset/icon_256x256@2x.png
sips -z 512 512   pic.png --out tmp.iconset/icon_512x512.png
sips -z 1024 1024   pic.png --out tmp.iconset/icon_512x512@2x.png
```

4. 通过 iconutil 生成 icns 文件

```shell script
$ iconutil -c icns tmp.iconset -o icon.icns
```

此时你的目录应该有了你想要的
