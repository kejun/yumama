# 宇妈的厨房

把喜欢的味道，留在家里。一个适合边做饭边看的静态菜谱本。

首批收录红烧黄花鱼、红烧带鱼、香煎厚切牛排。支持食材勾选、搜索与分类、本机收藏、大字分步烹饪、进度恢复、厨房计时、可选屏幕常亮、打印。

## 运行

需要 Node.js 22 或更新版本。浏览器端没有第三方运行依赖；开发测试使用 linkedom。

```sh
npm ci
npm run check
python3 -m http.server 8080 --directory dist
```

打开 <http://localhost:8080>。请通过 HTTP(S) 服务访问，直接双击 HTML 时浏览器可能阻止 ES modules。菜谱正文在禁用 JavaScript 时仍可阅读。

## 发布

将 `npm run build` 生成的 `dist/` 目录上传到任意静态托管平台即可。支持站点根路径和子目录，不需要 SPA 路由回退。

GitHub Pages：在仓库 Settings → Pages 中选择 GitHub Actions。推送或合并到 `main` 后，**Deploy GitHub Pages** 工作流自动检查、构建并发布；也可手动运行。不发布功能分支。默认访问地址为 https://kejun.github.io/yumama/ 。

## 内容维护

- `data/recipes.json`：食材、操作步骤、原作步骤映射、来源署名。
- `public/assets/recipes/<来源 ID>/`：本地封面和步骤图。
- `data/image-sources.json`：图片来源、尺寸与完整性清单。
- `scripts/build.mjs`：静态页面生成器。
- `public/app.js`、`public/state.mjs`：浏览器交互与状态校验。
- [KEJ-23 实现方案](docs/KEJ-23-implementation.md)：范围、结构、交互和验收。

牛排菜谱已根据用户提供的截图恢复介绍和 21 个原始步骤，逐步保留正文及对应图片；另两道鱼类菜谱目前仍是操作整理版。原文数字与措辞保留，本站补充说明单独展示。图片版权归原作者，仓库未授予第三方图片的再许可。

## 使用边界

收藏和进度只保存在当前浏览器中，不跨设备同步；清理浏览器数据会移除记录。计时器在返回页面时按截止时间校准，锁屏或离开页面不会提醒。常亮功能需要 HTTPS、安全上下文和浏览器支持；是否成功以页面提示为准。

首次访问需要网络；本版本不承诺离线访问。页面运行不请求下厨房资源，不加载外部字体或统计脚本。
