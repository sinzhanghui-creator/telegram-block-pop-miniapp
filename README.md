# Block Pop Mini — Telegram Mini App MVP

一个移动端优先的 Telegram Mini App 消除类游戏原型，玩法参考 Block Blast：拖动底部方块到 8×8 棋盘，填满整行或整列即可消除得分。

## 已实现

- 8×8 方块消除核心玩法
- 3 个随机方块拖拽放置
- 行/列消除、连击、最高分本地保存
- Game Over 判断
- Telegram WebApp SDK 初始化：`ready()` / `expand()` / 主题色设置 / 触觉反馈
- 分享成绩到 Telegram
- 广告变现预留：
  - Banner 广告位
  - 分数里程碑插屏广告位
  - 激励广告换方块
  - 激励广告复活

## 本地运行

```bash
cd /Users/zhangjack/telegram-block-blast-miniapp
python3 -m http.server 8765
```

浏览器打开：

```text
http://localhost:8765/index.html
```

## Telegram Mini App 上线步骤

1. 找 @BotFather 创建 Bot。
2. 使用 `/newapp` 创建 Mini App，填写名称、描述、图标和 Web App URL。
3. 将本项目部署到 HTTPS 域名，例如 Vercel、Cloudflare Pages、Netlify 或自己的服务器。
4. 在 @BotFather 里把 Mini App URL 设置为部署后的 HTTPS 地址。
5. 如需在 Bot 菜单中打开，配置 Menu Button 或 inline keyboard `web_app` 按钮。

## 广告变现接入建议

Telegram Mini App 的广告可以分三层：

1. Banner：常驻底部或顶部轻量广告，适合低干扰变现。
2. Interstitial：每局结束、分数里程碑、连续玩几局后触发。
3. Rewarded：用户主动看广告换奖励，例如复活、换方块、撤销一步、双倍金币。

当前代码中的广告桥接层在 `game.js`：

```js
const adBridge = {
  async showBanner() {},
  async showInterstitial(reason) {},
  async showRewarded(reason) {}
}
```

后续把这里替换成真实广告 SDK 即可。

## 推荐商业模式

- 免费玩，广告变现为主。
- 激励广告优先于强插屏：复活、换块、撤销、双倍奖励。
- 插屏广告控制频率：每 2-3 局一次，或分数达到里程碑时触发。
- 可加轻付费：去广告、每日礼包、皮肤、主题、排行榜特权。
- Telegram 增长：成绩分享、邀请挑战、频道榜单、群内排行榜。
