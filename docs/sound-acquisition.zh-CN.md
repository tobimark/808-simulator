# 808 音源获取与许可证核查

调研日期：2026-10-20。目标：为 [iOS 808 调研](ios-808-research.zh-CN.md) 里的项目找到**免费或低成本、且能合法随商业 App 分发**的鼓声音源。

本文只陈述公开许可证原文与事实，**不构成法律意见**；上架前涉及"把音频嵌入软件"的条款建议再做一次律师复核。所有链接的访问日期均为 2026-10-20。

---

## 0. 结论（TL;DR）

**能拿到免费音源，而且有可以随 App 分发的。** 但必须先接受一个事实：

> **"免费下载" ≠ "能打包进 App"。** 大量免费 808 采样包只授权"用于音乐作品"，明确禁止放进 app / software。判断标准是许可证原文，不是价格。

按风险从低到高，推荐三条路线：

| 路线 | 现金成本 | 授权风险 | 适合阶段 |
| --- | --- | --- | --- |
| **A. 自研合成**（现有 `prototype/808_poc.py`，可参考 MIT 的 io-808） | 0 | 几乎为零 | 首发首选；音色需听感验收 |
| **B. CC0 采样**（FreePats、Freesound 的 CC0 单条/套鼓） | 0 | 低（需逐条留证） | 原型、混合音源、补声部 |
| **C. 付费/定制授权**（Samples From Mars 购买 app license、委托录音） | 需询价 | 合同明确 | 想要商业采样库质感时 |

**明确不要直接打包的**（本报告逐一给出了原因）：

- Samples From Mars 的免费 808 包——条款原文限定 "within your new musical compositions and productions only"，FAQ 明确 "you may not use these sounds in any website, application, or software"；
- 99Sounds、Splice、Looperman、Cymatics、SampleFocus 等"免费/订阅采样"——授权只覆盖音乐作品/成品音频，不覆盖把 WAV 当产品音源分发；
- Roland 官方/硬件附带的 TR-808、TR-S、Serato sample pack——EULA 甚至明确禁止 "competitive offering"；
- GPL 音源（如 Hydrogen 的 TR808EmulationKit、FreePats GM 打击乐）——闭源 App 不能用；
- 从 TR-909 / TR-707 / TR-727 等 PCM ROM 机器提取的采样、来源不明或转传商业包的"CC0"上传——权利链不清；
- 用免费 VST 渲染后打包——EULA 通常没有给"嵌入软件"的授权（Synsonic 即为例）。

> **本轮对 13 家常见"免费/免费增值"商业采样来源的核查结论是：0 家提供可随闭源 App 分发的明确授权。** "未核实 ≠ 可用"——拿不到书面许可，就按不可用处理。免费且可打包的路线实际上只剩两条：**CC0**（见 §2.2）和**自研合成**（见 §2.1）。

**最省事的免费组合**：自研合成引擎 + FreePats CC0 采样垫底 + 需要更像真机时用 Freesound 的 CC0 单次击打（逐条留证）。本报告附带了已经渲染好的试听文件和来源清单。

---

## 1. 判断框架：四种权利不要混在一起

| 层 | 内容 | 对本项目的含义 |
| --- | --- | --- |
| L1 软件/代码许可 | 能不能用某个合成器、库、代码 | MIT/BSD 可闭源；GPL/AGPL 传染；商用 VST 看 EULA |
| L2 录音/采样著作权 | 这段录音本身归谁 | 采样包的录音受保护；CC0 才是放弃权利 |
| L3 再分发合同 | 能不能把音频**嵌入另一个产品** | 绝大多数免费采样包在这里禁止"app/software 分发" |
| L4 商标/外观 | "808"、"TR-808" 名称与面板 | Roland 有相关商标；产品名与 UI 需自有表达 |

几条容易踩的细节：

1. **808 是模拟电路，不是 PCM ROM 机器。** Freesound 官方 FAQ 明确说：采模拟合成器一般没问题，但采数字 ROM 合成器（如 TR-707、TR-909 的镲/踩镲、Linn Drum）可能是在复制机器内存里的版权采样，属于侵权。(`https://freesound.org/help/faq/`)
2. **CC0 只解决 L2，不解决 L4。** CC0 原文："In no way are the patent or trademark rights of any person affected by CC0" (`https://creativecommons.org/publicdomain/zero/1.0/`)。录音可以自由用，但"808 / TR-808"作为产品名或复刻面板仍有商标/外观风险。
3. **Freesound 是逐条许可，不是整站许可。** 每个声音页显示各自的 CC 许可证；同一个 pack 里可能混有 CC0 和 CC-BY（例：Batcave 808s 就是 18 条 CC0 + 6 条 CC-BY）。必须逐条核对，不能按 pack 整体判断。
4. **行业惯例佐证 L3 有多关键。** 连明确允许"随便发行你的音乐、包括 stems"的 Spectrasonics，也把"嵌入其他软件或硬件"单列为需要另行 clearance 的例外 (`https://support.spectrasonics.net/manual/StylusRMX/1.10/en/topic/sampling-faqs`)。所以"这个包允许做音乐"绝不能被理解成"可以放进鼓机 App"。
5. **Freesound 的 CC0 是上传者声明，平台不核实。** ToS 要求上传者保证 "he/she has all necessary rights in the sound and metadata"，但同页也说明平台不控制、不监督用户内容 (`https://freesound.org/help/tos_web/`)。ToS 里 "you may not use the Freesound website portal for commercial purposes" 约束的是把站点/API 当商业服务使用，不是限制单个 CC 声音的授权；批量获取应走官方 API 并遵守其条款。

### 1.1 常见许可证速查

| 许可证 | 可闭源商业 App 打包 | 署名 | 备注 |
| --- | --- | --- | --- |
| CC0 1.0 | ✅ | 不要求 | 最省事；仍建议保留来源记录 |
| CC-BY 3.0 / 4.0 | ✅（需署名） | 必须 | 4.0 还要求注明是否修改；3.0 仅在衍生时要求 |
| CC-BY-NC | ❌ | — | 商业 App 一律排除 |
| CC-BY-SA / ND | ⚠️ | 必须 | 有传染/禁止改编风险，闭源 App 不建议 |
| MIT / BSD | ✅ | 保留版权声明 | 代码路线优先 |
| GPL / AGPL | ❌（闭源） | — | 会要求整个 App 开源；音源和代码都适用 |
| "Royalty-free for music" | ❌（默认） | — | 这是音乐作品授权，不包含 app 内分发 |

---

## 2. 可打包来源清单（按出处可信度分级）

### 2.1 自研 / 开源代码（零采样授权风险）

| 来源 | 内容 | 许可证 | 闭源商用 | 说明 |
| --- | --- | --- | --- | --- |
| 本项目 `prototype/808_poc.py` | 13 声部纯合成 + 采样级音序 | 自有 | ✅ | 已完成时序/电平/客观信号检查；听感未验收 |
| [vincentriemer/io-808](https://github.com/vincentriemer/io-808) | Web Audio 全 16 声部合成，**无任何采样** | MIT | ✅ | 743★，2026-08 仍在更新；作者自评 cymbal/rimshot 较弱，可自研补强 |
| [coolbutuseless/tr808r](https://github.com/coolbutuseless/tr808r) | R 语言 808 实现 | MIT | ✅ | 适合参考算法 |
| [houli/PR-808](https://github.com/houli/PR-808) | PureScript 808 | MIT | ✅ | 参考实现 |
| [PLUSDEVLLC/react808.com](https://github.com/PLUSDEVLLC/react808.com) | Web Audio 808 | MIT | ✅ | 参考实现 |
| [copych/AcidBox](https://github.com/copych/AcidBox) | 808/909 鼓组 + 303（C++/ESP32） | MIT | ✅ | 参考实现 |
| [pangrus/hachi](https://github.com/pangrus/hachi) | norns 808 | CC0 | ✅ | 参考实现 |
| [Tone.js](https://github.com/Tonejs/Tone.js) / [AudioKit](https://github.com/AudioKit/AudioKit) | Web Audio / iOS 音频框架 | MIT | ✅ | 无现成 808 套件，但可搭引擎 |
| [DaisySP](https://github.com/daisyaudio/DaisySP) | C++ DSP；含 AnalogBassDrum / AnalogSnareDrum / HiHat | MIT（另有可选 LGPL 子模块） | ✅ | 可补 kick/snare/hihat；不要引入 LGPL 子模块 |
| [JUCE](https://github.com/juce-framework/JUCE) | C++ 音频框架（含 AUv3） | AGPLv3 或商业许可 | ⚠️ 需买商业许可（年收入 ≤ $20k 有免费 Starter 档） | 不打算开源就必须买 |
| [Faust](https://github.com/grame-cncm/faust) | DSP 语言 | 编译器 GPL；生成代码不受限 | ⚠️ | 用作者侧工具生成 DSP 可行；避免 LGPL/BSD 架构文件 |
| [Hydrogen TR808EmulationKit](https://github.com/hydrogen-music/hydrogen/tree/main/data/drumkits/TR808EmulationKit) | 16 个从零合成的 808 声部 FLAC | GPL（drumkit.xml 内 `<license>GPL</license>`） | ❌ | 闭源 App 不要用 |
| FreePats General MIDI 打击乐 | GM 打击乐 | GPLv3 + 特例 | ❌ | 特例只覆盖音乐作品，不覆盖闭源 App |

> 说明：用 GPL 工具（如 Audacity、Faust 编译器）**渲染出的音频**一般不受 GPL 传染；真正有问题的是把 GPL 代码/音源**嵌入并分发**在你的 App 里。这条是工程师经验和许可证常识，仍建议上架前确认。

### 2.2 CC0 采样（可商用、可打包、无需署名）

**先看一个关键事实：CC0 只代表上传者的声明，不代表上传者一定有权。** Freesound 服务条款明确写着，上传者"warrants that he/she has all necessary rights"，但平台不主动核实；现实中确实有把商业采样包重新上传成 CC0 的例子（见 §2.3）。所以下面按"出处可信度"分级。

**A 级：出处明确，可优先使用**

| 来源 | 内容 | 许可证 | 备注 |
| --- | --- | --- | --- |
| [FreePats — Electric/Synthesizer Percussion](https://freepats.zenvoid.org/Percussion/electric-percussion.html) | 21 个合成鼓声：Kick×2、Snare×2、Clap、Closed/Open Hat、Cymbal×4、Tom×6、Claves、Shaker×2 | **CC0 1.0** | 作者用 Yoshimi/Geonkick 从零合成，**不是 808 复刻**，但权利链最干净；已下载到 `prototype/freepats-cc0-kit/` |
| [Karman_Lyne — Roland TR08 100% gain, default tuning](https://freesound.org/people/Karman_Lyne/packs/29226/) | 16 个单次击打：Kick、Snare、Closed/Open Hat、Tom×3、Conga×3、Clap、Cowbell、Rimshot、Maracas、Clave 等 | **CC0**（单条页原文已核） | 作者写明"Recorded direct from a Roland TR08 into MPC1000"，直录硬件输出，出处相对可信；44.1 kHz/16-bit 单声道。注意 TR-08 是数字建模复刻机，不是原机 |
| [Uberproduktion — Filthy Drums 808 Analog Drum Hits](https://freesound.org/people/Uberproduktion/packs/25700/) | 14 个短击：Snare、Tom×3、Conga×3、HiHat×2、Rimshot、Maracas、Cowbell、Cymbal | **CC0** | 描述为"drum hits processed to sound like an 808"，是处理后的音色；来源细节未说明，建议先试听再决定 |

**B 级：CC0 声明，但出处不清 / 混合许可，只建议原型或叠加使用**

| 来源 | 内容 | 许可证 | 风险点 |
| --- | --- | --- | --- |
| [EKVelika — 808 Deep kick](https://freesound.org/people/EKVelika/sounds/208447/) | 1 个 808 deep kick（1.315 s，44.1 kHz/24-bit） | **CC0**（页面已核） | 描述只有"808 deep low kick"，没有说明自录/自合成；Sonic Pi 把它当作 CC0 内置 `:bd_808`。可用于原型，上架前建议找更明确出处的替代 |
| [Rippleys_Circus — Trap Claps](https://freesound.org/people/Rippleys_Circus/packs/30604/) | 9 个 trap/808 风格 clap | **CC0**（页面标注） | **描述写着"One of many samples from drumkits I own"——很可能是商业鼓组采样再上传，CC0 声明可疑。不要用于上架** |
| [stomachache — Batcave 808s](https://freesound.org/people/stomachache/packs/9813/) | 24 个 808 击打，经小音箱+洞穴混响 | 混合：18 条 CC0 + 6 条 CC-BY | 必须逐条看；lo-fi 环境感，适合叠加层 |
| [Sonic Pi 内置采样库](https://github.com/sonic-pi-net/sonic-pi/blob/main/etc/samples/README.md) | 全套鼓/电声采样，含 `:bd_808` | 随 Sonic Pi 的 README 标注 CC0 | 上游仍是 Freesound 上传者，出处同样要逐条判断；`bd_808` 即上面的 EKVelika 文件 |

**搜索入口（不能整站直接用）**

- [Freesound CC0 筛选：TR-808](https://freesound.org/search/?q=TR-808&f=license:%22Creative+Commons+0%22)
- 截至 2026-10-20 的 CC0 结果数："TR-808" 1,323 条、"808 kick" 266 条、"808 snare" 144 条、"808 cowbell" 22 条。
- 同一搜索结果里还混有 loop、音乐片段和重新上传的文件，必须逐条看作者描述与许可证。

### 2.3 CC0 出处可疑的实例（为什么必须逐条看）

| 实例 | 页面描述 | 问题 |
| --- | --- | --- |
| [voxlab — TR-808 SFB _ SmoothBD](https://freesound.org/people/voxlab/sounds/749696/) | "TR-808 Kick (karman-lyne pack 29226) resampeled…" | 把别人的采样包再次上传并标 CC0；原包才是权利来源 |
| [Rippleys_Circus — Trap Claps](https://freesound.org/people/Rippleys_Circus/packs/30604/) | "One of many samples from drumkits I own" | "拥有鼓组"不等于"有权以 CC0 再分发" |
| [knocklessmonster — TR-808（Renoise 乐器）](https://files.renoise.com/forum/downloads/Instruments/Knocklessmonster-TR-808/description.html) | 页面写 "License: CC0, Public Domain"，但作者说明采样来自 "Waveworld torrent" 和 "AKWF pack" | 上游是 torrent 采样包，权利链不清 |

**核验口诀**：作者描述里出现 "from my pack"、"from drumkits I own"、"torrent"、"commercial pack"、"someone else's samples" → 不要用于上架，最多做原型。

### 2.3 CC-BY（可打包，但必须在 App 内署名）

| 来源 | 内容 | 许可证 | 署名要求 |
| --- | --- | --- | --- |
| [abletunes — 808 Bass Drums](https://freesound.org/people/abletunes/packs/23793/) | 20 个按音高命名的 808 bass drum（含 Distortion 变体，尾音约 3.5 s） | **CC-BY 3.0** | 作者 + 标题 + URL + 许可证 |
| [patchbanks/WaivOps-EDM-TR8](https://github.com/patchbanks/WaivOps-EDM-TR8) | 3,790 条 TR-808/electro 鼓 **loop**（约 9 小时，4.4 GB） | **CC BY 4.0** | 必须署名；**是 loop 不是 one-shot，不适合当鼓机音源**，只适合 demo pattern |
| [Tero Parviainen — @teropa/drumkit](https://cdn.jsdelivr.net/npm/@teropa/drumkit@1.1.0/README.md) | kick/snare/hat/tom/ride/crash 一组 WAV | 代码 MIT；采样混合 CC0 / CC-BY | CC-BY 部分署名 |

### 2.4 "免费"但不能用于闭源 App（见下节）

---

## 3. 免费但不可打包（只能试听 / 做原型）

| 来源 | 内容 | 许可证关键原文 | 判断 |
| --- | --- | --- | --- |
| [Samples From Mars — FREE 808 FROM MARS](https://samplesfrommars.com/collections/all-products-1/products/free-808-from-mars) | 2 套 16×808 击打（免费） | 条款 §9："The Audio Products are licensed, not sold, to you to be used for and reproduced **within your new musical compositions and productions only**. All copying, lending, duplicating, re-selling or trading ... strictly prohibited."（[Terms](https://samplesfrommars.com/pages/terms-conditions)）FAQ："you may not use these sounds in any website, application, or software."（[FAQ](https://samplesfrommars.com/pages/faq)） | ❌ 不可打包；可作**原型试听**。想用需联系购买 app/software license |
| [99Sounds](https://99sounds.org/license/) | 多个免费鼓/音效包 | "You do **not** have the right to sell or **redistribute (even for free)** the audio files ... as a separate attachment from any of your work." + "the sounds ... may **not** be used to create 'noise apps,' 'white noise apps,' 'sleep sound apps,' **and similar software**." | ❌ 本轮唯一直接写明"软件"的条款，鼓机 App 被排除 |
| [Splice](https://splice.com/terms) | 订阅/免费采样 | §3.1.1.3 Prohibited Uses："(a) **sublicense the Sounds in isolation** as sound effects, loops, or as source material for any other form of sample"; "(c) ... distribute ... the Sounds to a third party **except as incorporated into a New Recording or Creative Work**"; "(d) **redistribute Sounds in new sample packs**." | ❌ 可做歌曲/游戏成品音频，不能当鼓机内置音源 |
| [Roland TR-808 / TR-S / Serato pack](https://www.roland.com/us/support/by_product/rc_tr-808_modern_hip-hop_beats/owners_manuals/80eb3e5d-20ed-4c47-a868-7ce0e4563078/) | 808/909 风格采样 | EULA 禁止 "Sell, loan, rent, lease, **sublicense, distribute** ... the Software"；并禁止 "(O) Use the Software to create a **competitive offering**"、"(P) ... create other software, products or technologies" | ❌ 最高风险：808 鼓机正是 Roland 的核心竞品品类 |
| [Looperman](https://www.looperman.com/help/terms) | 用户上传 loop | 仅授权 "the Loops **solely as they are embodied in the Derivative Works**"；且 "Looperman cannot and does not review the legality of Content" | ❌ UGC 权利链不可控 |
| Cymatics（二手证据） | 免费采样 | 据 Freesound 用户转引官方许可："**No re-distribution** of the sounds or files ... **as another product**" + "single user only" | ❌（本次未亲见官网原文） |
| SampleFocus（二手证据） | 免费采样 | 据 Freesound 用户转引："may **not** be ... sublicensed, sold, resold or **redistributed alone - even for free**" | ❌ / 高风险（本次未亲见官网原文） |
| MusicRadar SampleRadar（含 [378 个免费 808 samples](https://www.musicradar.com/news/sampleradar-378-free-808-drum-samples)） | 免费 808 采样 | 官方条款页 TLS 阻断，未取到原文；二手报道："all royalty free … except **you can't redistribute/sell them**"（[RouteNote 2018](https://routenote.com/blog/mix-it-up-with-275-free-retro-drum-machine-samples/)）与 "they only request that they aren't redistributed anywhere"（2015） | ❌ 未核实；商业上架拿不到书面许可即不可用 |
| BPB / Ghosthack / ADSR / Output Arcade | 免费/免费增值包 | 站点 403/503 或许可段缺失，未取到原文 | ❌ "未核实 ≠ 可用" |
| Sonniss GDC bundle | 游戏音效库 | 许可证部分未核实；且不含 808 鼓组 | ⚠️ 仅可考虑 App 内 UI 音效/演示内容；不解决鼓机音源 |
| 免费 VST 渲染后打包（如 [Synsonic BD-808](https://synsonic-instruments.com/bd-808-pro/)） | 合成器渲染 WAV | EULA 第 4 条："**This EULA grants you no rights to use such content.** All rights not expressly granted are reserved"；第 2(b) 条禁止分发软件本体 | ⚠️ 无输出嵌入授权，别依赖；Spectrasonics 也把"嵌入软件"列为需 clearance |
| Hydrogen TR808EmulationKit / FreePats GM | 16 个合成 808 声部 / GM 鼓组 | GPL（drumkit.xml / 站点原文） | ❌ 闭源 App 不能用 |
| 来源不明或转传商业包的 "CC0" 上传 | 如 voxlab 的 Karman-Lyne 再上传、torrent 采样包 | 上传者未必有权 CC0 | ❌ 权利链不清，不要用 |

> **本轮核查 13 家常见免费/订阅采样来源，结论是 0 家可打包。** 这不是说所有采样都不能用——CC0 的 FreePats / Karman_Lyne 属于另一类（见 §2.2），自研合成是零风险路线。各家措辞高度一致：授权仅限 "within your musical compositions/productions"、"embodied in the Derivative Works"、"as incorporated into a New Recording"；要放进 App，必须拿到明确写入 **sublicensable**、**right to embed in and distribute as part of software applications** 的书面授权。

---

## 4. 推荐组合（按阶段）

### 阶段 0：现在就能做的原型（零成本）

- **引擎**：继续用 `prototype/808_poc.py` 的合成声部；参考 io-808（MIT）补强弱项（cymbal/rimshot）。
- **套鼓**：FreePats CC0（已在项目内）+ 你从 Freesound 下载的 Karman_Lyne TR-08 CC0 套鼓（需注册免费账号；逐条确认许可证）。
- **补充**：clap 先用 FreePats 的 Clap 或自行合成；需要长尾/低音时再试 EKVelika CC0（仅原型，出处不够明确）；**不要用 Rippleys_Circus 的包**（描述显示可能来自商业鼓组）。
- **试听**：`prototype/808-poc.wav`（纯合成）、`prototype/freepats-cc0-demo.wav`（CC0 套鼓）、`prototype/hybrid-kit-demo.wav`（混合音源，96 个事件）。
- **混合音源**：`prototype/hybrid_kit.py` 已把 10 个 CC0 采样与原始合成拼成 16 声部/11 通道，参数/来源/检查见 `prototype/hybrid-kit-manifest.json`。
- **留证**：每下载一条，记录 URL、作者、许可证、日期、SHA-256（见 §5）；混合音源已生成 `assets/provenance.csv`。

### 阶段 1：可上架的首版

- **首选**：全合成引擎（零授权风险），音色需你/真机听感验收。
- **次选**：出处明确的 CC0 采样（FreePats + Karman_Lyne，经留证）+ 自研合成补缺（如 cowbell/rimshot 用合成）。CC-BY 音源必须在 App 的 "Licenses / 致谢" 页署名。
- **不要**：把 §2.3 里出处可疑的 CC0、任何 "music-only" 免费包、GPL 音源打包进上架版本。
- **若一定要商业采样库的质感**：
  - 联系 Samples From Mars 等厂商购买 **app/software license**；合同必须明确写入 *sublicensable*、*right to embed in and distribute as part of software applications*、全球/永久/不可撤销/免版税，别只依赖 FAQ；
  - 或委托录音：找有 TR-808 的录音师，合同写明"允许嵌入商业 App、全球分发、修改/切片、后续版本继续使用、用户导出作品"。

### 阶段 2：高保真 / 原机还原

- 租/借一台有使用权限的 TR-808，自己录 Accent、Tone、Decay、Snappy 各档位；
- 或按调研文档 §5 走电路建模（研究级，另排期）。

---

## 5. 下载与留证流程（每条音源都做）

建议维护一张 `assets/provenance.csv`，字段如下：

| 字段 | 示例 |
| --- | --- |
| 内部 ID | `bd_808_karman_tr08_kd01_v1` |
| 文件名 / SHA-256 | `TR08_Kd01.WAV` / `…` |
| 来源 URL | Freesound sound 页/包页 |
| 作者 | Karman_Lyne |
| 许可证 | CC0 1.0（附页面截图或存档） |
| 下载日期 | 2026-10-20 |
| 是否修改 | 裁切/归一/重采样/降采样等 |
| 使用位置 | 预设、示例工程、压力测试 |
| 署名文本 | CC-BY 时需要；CC0 可选 |

操作建议：

1. 下载前**先看声音页的许可证区块**并截图（含 URL、作者、日期）；
2. 下载后算 SHA-256（PowerShell：`Get-FileHash <file> -Algorithm SHA256`）；
3. CC0 也留证——将来若有人主张权利，你能证明来源与授权判断；
4. CC-BY 在 App 内放 "Licenses" 页：作者、作品名、URL、许可证版本、是否修改；
5. 不把 CC-BY-NC / GPL / 来源不明的文件放进 `assets/`；
6. 定期重跑"来源 → 本地文件"的哈希校验。

**产品命名**：不要用 "808"/"TR-808" 当产品名或主视觉；可用 "808-style" 作描述性说明（具体风险需商标检索/律师意见）。UI 不要复刻 Roland 面板、Logo 与配色布局。

---

## 6. 成本对比

| 方案 | 现金成本 | 主要投入 | 风险 |
| --- | --- | --- | --- |
| 自研合成 | 0 | DSP 校准工时 | 音色听感需验证 |
| CC0 采样（FreePats + Freesound） | 0 | 逐条筛选/留证 0.5–1 天 | 质量参差、出处需甄别 |
| CC-BY（abletunes 等） | 0 | 同样留证 + App 内署名页 | 署名遗漏即违约 |
| 商业采样库 app 授权 | 需询价 | 合同沟通 | 取决于厂商是否提供 |
| 委托录音（TR-808） | 需询价 | 录音/后期/合同 | 一次性买断更干净 |

---

## 7. 已完成的本地验证

| 文件 | 内容 |
| --- | --- |
| `prototype/808_poc.py` | 13 声部纯合成 POC；96 事件/4 小节；时序最大舍入误差 < 0.5 采样；无削波 |
| `prototype/808-poc.wav` | 合成 POC 试听（24-bit / 48 kHz） |
| `prototype/freepats-cc0-kit/` | FreePats CC0 套鼓 21 个 WAV + LICENSE + `PROVENANCE.md`（含 SHA-256） |
| `prototype/freepats_kit_demo.py` | 用 CC0 套鼓按同一音序渲染 4 小节（92 事件，24-bit / 48 kHz） |
| `prototype/hybrid_kit.py` | 混合音源：10 个 CC0 采样 + 原始合成补 6 个声部；16 声部/11 通道 |
| `prototype/hybrid-kit-demo.wav` | 混合音源 4 小节试听（96 事件，24-bit / 48 kHz） |
| `prototype/hybrid-kit-voices.wav` | 16 个混合声部单击试听 |
| `prototype/hybrid-kit-params.wav` | BD Decay、SD Snappy、LT Tuning、OH/CY Decay 参数 A/B |
| `prototype/hybrid-kit-manifest.json` | 声部映射、采样/合成来源、参数说明、客观检查 |
| `assets/provenance.csv` | 22 个 CC0 采样（FreePats 21 + Sonic Pi `bd_808`）+ 8 个合成/混合声部的来源、许可、SHA-256 |
| `web/` | 可玩的网页 Demo：16 步/11 通道、Accent、choke、A/B Pattern、4–32 小节 Song Arranger + Loop、音色 A/B、HOUSE/TRAP/ELECTRO 三种风格、本地自动保存、工程 JSON 导入导出、WAV 导出 |
| `web/samples.js` | 浏览器 Demo 内嵌采样（FreePats CC0 + Sonic Pi CC0 `bd_808`） |
| `web/browser-render.wav` | 浏览器引擎离线渲染的 4 小节 WAV（House，48 kHz/16-bit，峰值 0.948，无削波） |
| `web/ab-*.wav` | Hats / Cymbal / Toms 的采样 vs 808 合成 A/B 试听文件（见 `web/AB-TEST.md`） |
| `web/style-house` / `web/style-trap` / `web/style-electro` `.wav` | 三个风格预设的试听 WAV（浏览器引擎离线渲染） |
| `web/README.md` | 网页 Demo 运行方式、操作、自测结果与限制 |

> 听感判断必须由人完成。本轮没有监听设备、也没有做盲听，不能宣称任何音源"像 808"。

---

## 8. 来源清单（访问日期 2026-10-20）

- Roland TR-08 pack（CC0）：https://freesound.org/people/Karman_Lyne/packs/29226/
- Freesound CC0 搜索：https://freesound.org/search/?q=TR-808&f=license:%22Creative+Commons+0%22
- Freesound FAQ（模拟/ROM 区分、CC 条款）：https://freesound.org/help/faq/
- Freesound ToS（逐条许可）：https://freesound.org/help/tos_web/
- CC0 1.0：https://creativecommons.org/publicdomain/zero/1.0/
- CC BY 4.0：https://creativecommons.org/licenses/by/4.0/
- FreePats 合成打击乐：https://freepats.zenvoid.org/Percussion/electric-percussion.html
- FreePats GM（GPL）：https://freepats.zenvoid.org/SoundSets/general-midi.html
- Samples From Mars FAQ：https://samplesfrommars.com/pages/faq
- Samples From Mars Terms：https://samplesfrommars.com/pages/terms-conditions
- Samples From Mars FREE 808：https://samplesfrommars.com/collections/all-products-1/products/free-808-from-mars
- 99Sounds License：https://99sounds.org/license/
- Splice Terms（§3.1.1.3）：https://splice.com/terms
- Looperman Terms：https://www.looperman.com/help/terms
- Roland TR-808 Modern Hip-Hop EULA：https://www.roland.com/us/support/by_product/rc_tr-808_modern_hip-hop_beats/owners_manuals/80eb3e5d-20ed-4c47-a868-7ce0e4563078/
- Spectrasonics Sampling/Trademark FAQ：https://support.spectrasonics.net/manual/StylusRMX/1.10/en/topic/sampling-faqs
- io-808（MIT）：https://github.com/vincentriemer/io-808
- tr808r（MIT）：https://github.com/coolbutuseless/tr808r
- PR-808（MIT）：https://github.com/houli/PR-808
- DaisySP（MIT）：https://github.com/daisyaudio/DaisySP
- AudioKit（MIT）：https://github.com/AudioKit/AudioKit
- Tone.js（MIT）：https://github.com/Tonejs/Tone.js
- JUCE（AGPL/商业）：https://github.com/juce-framework/JUCE
- Hydrogen TR808EmulationKit（GPL）：https://github.com/hydrogen-music/hydrogen/tree/main/data/drumkits/TR808EmulationKit
- WaivOps EDM-TR8（CC BY 4.0）：https://github.com/patchbanks/WaivOps-EDM-TR8
- Sonic Pi samples README：https://github.com/sonic-pi-net/sonic-pi/blob/main/etc/samples/README.md
- EKVelika — 808 Deep kick（CC0）：https://freesound.org/people/EKVelika/sounds/208447/
- Sonic Pi `bd_808.flac`（镜像）：https://cdn.jsdelivr.net/gh/sonic-pi-net/sonic-pi@dev/etc/samples/bd_808.flac
- Synsonic BD-808 EULA：https://synsonic-instruments.com/policies/

---

## 9. 局限与未核实项

- 本文不是法律意见；上架前建议就"音频嵌入软件"的再分发条款请律师复核。
- Freesound 的 CC0 只能证明"上传者声明"，不能证明上传者一定有权；本报告已标出两个权利链可疑的例子，使用前必须逐条看作者描述。
- Karman_Lyne 的套鼓录自 Roland TR-08（数字建模复刻机），并非原版 TR-808；音色与"原机直录"会有差距（未听感验证）。
- MusicRadar / BPB / Ghosthack / ADSR / Output Arcade 的许可证本次未取到页面原文（TLS 阻断 / Cloudflare 403 / 503），按"未核实 = 不可用"处理；Cymatics / SampleFocus 是二手转引的证据，同样未亲见官网原文。
- 13 家商业免费/订阅采样来源的核查结论是 **0 家可打包**；但这只覆盖本轮检查的厂商，不代表所有厂商。若厂商明确书面提供 "app & software redistribution license"，另当别论。
- 未从 Freesound 实际下载音频（需要登录账号），未做任何音源试听或盲听；本地只有 FreePats CC0 套鼓的试听。
- 商标状态（"808"/"TR-808"）未做完整商标检索；Roland 的商标主张和各地注册状态需另行确认。Roland 的 EULA 是为其软件/音色产品写的，具体到哪一份采样包适用哪份条款，仍需逐项核对。
