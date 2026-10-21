# Rhythm Composer 808 — Web Demo

一个可玩的 808 风格步进鼓机 Demo：**FreePats CC0 采样 + 原创合成**混合音源、16 步音序器、
11 个乐器通道、Accent、开镲截音、Swing、3 个风格预设、**4–32 小节 Song Arranger**、
**音色 A/B（采样 vs 808 合成）**、自动保存、工程 JSON 导入/导出与 WAV 导出。

界面是参考 project 根目录两张 808 面板照片做的 **原创 CSS 重绘**（保留布局、配色、旋钮/步进键的硬件感，
但没有使用 Roland 的 Logo、面板图片或任何官方采样）。

> 这是 demo，不是可发布的成品；音色没有做 AI 人耳盲听验收，A/B 试听文件见
> [AB-TEST.md](AB-TEST.md)。

## 怎么运行

### 方式 1：本地静态服务器（推荐）

```powershell
cd web
python -m http.server 8137
```

打开 <http://127.0.0.1:8137/>。当前会话里这个服务已经在 8137 端口运行，可直接访问。

### 方式 2：直接打开文件

双击 `web/index.html` 也可以（所有采样都已 base64 内嵌，无需 fetch）。Chrome / Edge 对 FLAC 解码支持正常；
如果浏览器不支持 FLAC 或本地文件限制，使用方式 1。

## 操作

| 操作 | 说明 |
| --- | --- |
| 点击乐器列 | 选中当前编程的通道（BD / SD / Toms / RS / CP / CB / CY / OH / CH / ACCENT） |
| 点击步进键 1–16 | 切换当前通道在该步的开关；打开时会试听一次 |
| START / STOP 或空格 | 开始 / 停止，按 Song 的 Chain 和 Loop 区间循环 |
| STYLE | 切换 HOUSE / TRAP / ELECTRO 预设（Pattern + BPM + Swing + 参数） |
| A / B 按钮 | 选择要编辑的 Pattern |
| SONG / EDIT ▸ | 打开 Song Arranger：4/8/16/32 小节、A/B、Loop、复制粘贴 |
| CHAIN 迷你条 | 主面板上的 16 格小条，点击也打开 Song Arranger |
| VOICE A/B | HATS / CYMBAL / TOMS 各自切换 SAMPLE 与 808 合成版本 |
| 旋钮上下拖动 / 滚轮 | 调 LEVEL、TONE、DECAY、SNAPPY、TUNING；双击复位 |
| TOM/CONGA、RIM/CLAVES、CLAP/MARA 小开关 | 切换共享通道里的两种音色（经典 808 行为） |
| BPM / SWING | 40–300 BPM；Swing 0–80% |
| TAP | 跟随点击估算 BPM |
| CLEAR | 清空当前通道；Shift+点击清空全部 |
| RESET | 恢复当前风格预设，并把 Song 重置为 4 小节 A A A B |
| EXPORT / IMPORT | 下载/读取完整工程 JSON |
| WAV | 用当前风格、BPM、完整 Chain、音色模式离线渲染，下载 48 kHz / 16-bit WAV |

所有改动会自动保存到浏览器 `localStorage`（key：`rc808-project-v1`），刷新/重开页面会自动恢复。

## Song Arranger

- **长度**：4 / 8 / 16 / 32 小节。变长时用现有 Chain 循环填充，变短时裁剪。
- **A/B**：点击任意小节切换 A/B；A 是基本节奏，B 是 fill 变化。
- **Loop 区间**：输入起始/结束小节（1-based），播放只在该区间内循环；默认 1–N。
- **COPY / PASTE**：复制整条 Chain 到页内剪贴板并粘贴；复制内容随当前页面生命周期保存。
- **CLEAR**：把整条 Chain 全部设为 A。
- **WAV 导出**：渲染**完整 Chain**（不是只渲染 Loop 区间），方便导出整首编排。
- 主面板 CHAIN 迷你条显示整条 Chain 的 A/B 与 Loop 范围，播放时当前小节点亮。

## 音色 A/B（人耳试听）

HATS、CYMBAL、TOMS 三组声部各有两个版本：

| 组 | SAMPLE | 808 合成 |
| --- | --- | --- |
| HATS | FreePats Closed/Open Hat 采样 | 6 个方波振荡器 + 高通/包络的 808 金属模型 |
| CYMBAL | FreePats Cymbal 采样 | 金属振荡器 + 噪声 + 高通/长包络 |
| TOMS | FreePats Tom 采样 | 正弦音高下坠 + 短噪声击打 |

默认使用 **808 合成版**；在页面顶部 VOICE A/B 里点 SAMPLE 可即时切回采样版。
渲染好的 A/B 文件（同一 Pattern、同一 BPM、等响度附近）在 `web/ab-*.wav`：

- Hats: [ab-hats-sample.wav](ab-hats-sample.wav) · [ab-hats-808.wav](ab-hats-808.wav)
- Cymbal: [ab-cymbal-sample.wav](ab-cymbal-sample.wav) · [ab-cymbal-808.wav](ab-cymbal-808.wav)
- Toms: [ab-toms-sample.wav](ab-toms-sample.wav) · [ab-toms-808.wav](ab-toms-808.wav)
- 整段 House 对比: [ab-all-sample.wav](ab-all-sample.wav) · [ab-all-808.wav](ab-all-808.wav)

客观差异（不是好坏判断）：

| 对比 | Peak | RMS | >6 kHz 能量 | <100 Hz 能量 |
| --- | --- | --- | --- | --- |
| Hats sample | 0.202 | -37.04 dBFS | 80.4% | 0% |
| Hats 808 | 0.123 | -37.77 dBFS | 86.2% | 0% |
| Cymbal sample | 0.330 | -35.38 dBFS | 41.5% | 0% |
| Cymbal 808 | 0.150 | -35.48 dBFS | 81.8% | 0% |
| Toms sample | 0.355 | -25.07 dBFS | 10.0% | 22.2% |
| Toms 808 | 0.290 | -24.49 dBFS | 13.8% | 8.7% |
| All sample | 0.951 | -9.71 dBFS | 23.6% | 25.5% |
| All 808 | 0.947 | -9.68 dBFS | 35.0% | 23.0% |

**I cannot listen**：上面的数字只能说明频谱/电平差异，不能说明哪一版更好听。请戴上耳机，按 [AB-TEST.md](AB-TEST.md) 的顺序逐对试听。

## 音源

引擎在 `audio.js`，采样在 `samples.js`（`build_samples.py` 生成）。

| 声部 | 来源 |
| --- | --- |
| BD 底鼓 | `bd_808.flac`（Sonic Pi 内置 `:bd_808`，原 Freesound EKVelika #208447，CC0）+ 合成 sine sub 层 |
| SD 军鼓 | FreePats Snare09 + 合成噪声层（Snappy 控制） |
| Tom / Clap / Claves / Cymbal / Open Hat / Closed Hat | FreePats Synthesizer Percussion（CC0 1.0），其中 Hats/Cymbal/Toms 可切到合成版 |
| Conga / Rimshot / Maracas / Cowbell | 原创合成代码（移植自 `prototype/808_poc.py`） |

- 采样逐条许可与 SHA-256：`../assets/provenance.csv`、`../assets/cc0-extra/PROVENANCE.md`、`../prototype/freepats-cc0-kit/PROVENANCE.md`
- 参数映射是**近似**：Tone 用低通/播放速率、Decay 用指数包络、Snappy 用噪声层量，不是原机模拟电路。
- 没有使用 Roland 的录音、ROM 采样、Logo 或面板图片；"808" 仅作描述性使用。

## 浏览器端自测

打开 `http://127.0.0.1:8137/?selftest=1` 会显示一个诊断层，用 OfflineAudioContext 渲染默认 4 小节并输出：
事件数、峰值、RMS、削波数、非有限值数。最近一次结果（默认 808 METAL/SYNTH）：

```json
{
  "mode": "offline",
  "sampleRate": 48000,
  "events": 84,
  "accentSteps": 16,
  "peakDb": -0.48,
  "rmsDb": -8.47,
  "clipped": 0,
  "nonFinite": 0,
  "ok": true
}
```

开发机上的 CDP 自动化（无 npm 依赖）会额外截取页面、验证交互、导出浏览器渲染的 WAV：

```powershell
node web/test_cdp.mjs "http://127.0.0.1:8137/"
```

产物：`web/screenshot.png`、`web/screenshot-playing.png`、`web/screenshot-song.png`、`web/browser-render.wav`。

CDP 自动化还验证了：

- 12 个乐器列、16 个步进键、24 个旋钮；
- 播放头推进、步进切换、A/B 编辑；
- Song 面板可打开；切到 16 小节时网格 16 格，切到 32 小节时网格 32 格（两行）；
- VOICE A/B 按钮能在 `metal → sample` 间切换；
- 点第 6 步 + 把 Chain 改成 16 小节并设 Loop 2–8 后刷新页面，Chain 长度、A/B 与 Loop 区间都保持
  （自动保存/恢复通过）。

## 风格预设

| 风格 | BPM / Swing | 节奏与音色 |
| --- | --- | --- |
| **HOUSE** | 124 / 10% | 四拍底鼓、2/4 军鼓+拍手、八分闭镲、反拍开镲 |
| **TRAP** | 140 / 0% | 半拍感：底鼓 1、7、11、15 步，军鼓/拍手在 9 步，16 分连打闭镲 |
| **ELECTRO** | 96 / 22% | 摇摆 electro/boom-bap：切分底鼓、2/4 军鼓、8 分闭镲、牛铃与边击 |

三个风格各自有 A/B Pattern（A 基本节奏，B fill 变化），并共用当前 Song Arranger。
也可用 URL 直接进入某个风格：`?style=trap`、`?style=electro`。

三个风格的浏览器离线渲染（默认 808 合成音色）：

| 风格 | 时长 | Peak | RMS | 削波 | <100 Hz | >6 kHz |
| --- | --- | --- | --- | --- | --- | --- |
| House | 10.74 s | 0.948 | -9.68 dBFS | 0 | 23.0% | 35.0% |
| Trap | 9.86 s | 0.969 | -8.31 dBFS | 0 | 39.7% | 13.1% |
| Electro | 13.00 s | 0.950 | -13.08 dBFS | 0 | 20.6% | 35.7% |

注意：三首的 RMS 不同是编曲密度不同导致的，不是同一响度标准；试听时请用播放器音量补偿。

## 文件

| 文件 | 内容 |
| --- | --- |
| `index.html` / `style.css` / `app.js` | 界面、步进音序、Song Arranger、旋钮、离线导出 |
| `audio.js` | Web Audio 混合音源引擎（采样 + 金属 hats/cymbal + 合成 toms/conga/rimshot/cowbell） |
| `samples.js` | base64 内嵌采样（约 1.1 MB） |
| `build_samples.py` | 从 `prototype/freepats-cc0-kit` 与 `assets/cc0-extra` 重新生成 `samples.js` |
| `test_cdp.mjs` | 无依赖 CDP 自动化：自测、交互、Song/持久化、截图、导出 WAV |
| `render_styles.mjs` | 用无头 Chrome 渲染 3 个风格的 WAV + PNG |
| `render_ab.mjs` | 生成 8 个音色 A/B WAV + `ab-report.json` |
| `ab-*.wav` / `ab-report.json` | Hats / Cymbal / Toms / 整段的 A/B 试听文件与渲染参数 |
| `AB-TEST.md` | 人耳 A/B 试听顺序、重点听什么、反馈问题 |
| `screenshot.png` / `screenshot-playing.png` / `screenshot-song.png` / `screenshot-song32.png` | 主界面 / 播放中 / 16 小节 / 32 小节 Song Arranger |
| `style-*.wav` / `style-*.png` | 三个风格的试听与截图 |
| `browser-render.wav` | House 默认参数的浏览器离线渲染 |

## 已知限制

- **没有做人耳试听/盲听**，A/B 文件只是把两个版本渲染出来；哪版更接近原机需要你听。
- 808 金属 hats/cymbal 用 6 个方波振荡器近似，合成 toms 用正弦音高下坠近似；不是原机电路建模。
- 采样版本仍非原机直录；没有参考录音的逐档位校准。
- Song Arranger 最多 32 小节但只有 A/B 两个 Pattern；没有每小节独立 Pattern 槽、Mute/Solo、逐小节速度/力度自动化。
- WAV 导出渲染完整 Chain（16-bit），不是只渲染 Loop 区间；没有分轨导出。
- 保存只有浏览器本地一份 + JSON 文件，没有云同步或多工程槽位。
- 移动端只是整体缩放，触控目标偏小；没有专门的竖屏/横屏布局。
- 浏览器实时音频的最终延迟取决于设备/缓冲；本项目只用 OfflineAudioContext 验证了渲染正确性。
