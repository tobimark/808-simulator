# 808 声音与时序最小验证（POC）

这不是产品，也不是首版代码。它是用 1 个脚本回答两个高风险问题的最小实验：

1. **不依赖任何第三方采样**，能否从零合成 808 风格的整套鼓声？
2. **16 分音符音序**能否做到逐采样精确，包括非整数 BPM 和长时间播放？

对应 `docs/ios-808-research.zh-CN.md` 的 §5（声音路线）、§8（验收）与 §11（第一优先验证）。

## 运行

```powershell
# 项目依赖：Python 3.12 + numpy + Pillow（当前环境已具备）
python prototype/808_poc.py
```

脚本约 2 秒完成，输出：

| 文件 | 内容 |
| --- | --- |
| `808-poc.wav` | 4 小节、120 BPM、96 个事件的完整节奏，24-bit / 48 kHz 立体声 |
| `808-poc-voices.wav` | 13 个声部依次单击，每个间隔 1.2 s，用于人工试听 |
| `808-poc-spectrogram.png` | 波形 + 频谱图 |
| `808-poc-analysis.json` | 事件表、电平、时序和客观信号检查（含每次 event 的采样位置） |

## 本次已验证

- 13 个声部全部为**纯合成**（底鼓、军鼓、拍手、闭/开镲、镲片、边击、牛铃、沙锤、响棒、低/中/高通鼓），可无授权素材风险地做原型。
- 开镲被闭镲截音（choke）按共享电路语义实现：所有 15 个开镲事件都在 0.25 s 后被闭镲截断。
- 96 个事件的调度位置由采样序号直接决定；对 120 / 137 / 96.3 / 300 BPM、4 / 64 小节做过网格检查，**最大舍入误差 < 0.5 采样**；120 BPM 的 4 小节循环恰好 384,000 采样。
- 输出文件无 NaN/Inf、无削波；峰值 -0.56 dBFS，RMS -8.48 dBFS。
- 客观信号检查（不能替代听感）：底鼓低频起音约 125 Hz 滑落到 57.5 Hz；军鼓鼓身峰值 180 Hz；闭镲频谱重心约 13.2 kHz，6 kHz 以上能量占比 87%；镲片 5 kHz 以上能量占比 93%。

## 明确未验证 / 不能当作结论的部分

- **没有做听感验收**：没有原机或授权参考录音、没有盲听，因此不能声称"像 808"或"高保真"。
- 音色参数（Tone、Decay、Snappy、Accent 的听感曲线）尚未与参考设备校准；当前只是可调的合理范围。
- 未在 iPhone / 真机上验证实时性能、延迟、中断、路由与热稳定性。
- 不是最终架构：脚本中的声部函数是刻意隔离的，便于之后移植到 Web Audio / C++ / AVAudioEngine，但需要重写为实时安全实现（预分配、无锁队列、按块渲染）。
- 未包含界面、音序器编辑、保存、导出、AUv3 等任何产品功能。

## CC0 采样备选（FreePats）

`freepats-cc0-kit/` 是从 FreePats 项目下载的 "Synthesizer Percussion" 套鼓（CC0 1.0，无需署名），
包含 21 个 48 kHz WAV：Kick×2、Snare×2、Clap、Closed/Open Hat、Cymbal×4、Tom×6、Claves、Shaker×2。
来源与每个文件的 SHA-256 记录在 `freepats-cc0-kit/PROVENANCE.md`。

- `freepats_kit_demo.py`：用这套 CC0 采样按同一音序渲染 4 小节（92 个事件，24-bit / 48 kHz）。
- `freepats-cc0-demo.wav`：输出试听。
- 局限：这是合成器近似音，不是 TR-808 录音；缺 cowbell / rimshot / conga / maracas。

## 混合音源（FreePats CC0 + 自研合成）

`hybrid_kit.py` 把 CC0 采样和自研合成拼成 16 个声部（经典 11 通道组织）：

- 采样部分：FreePats 的 Kick、Snare、Tom、Clap、Claves、Cymbal、开/闭镲；
- 合成部分：底鼓 sub 层、军鼓噪声层、Low/Mid/High Conga、Rimshot、Maracas、Cowbell；
- 参数：Level、Tone、Decay、Snappy、Tuning（采样声部的 Tone/Decay 用滤波与包络近似，见 manifest 说明）。

运行（约 10 秒；会重新生成 `assets/provenance.csv`）：

```powershell
python prototype/hybrid_kit.py
```

| 文件 | 内容 |
| --- | --- |
| `hybrid-kit-demo.wav` | 4 小节 / 96 事件 / 24-bit 48 kHz 的完整节奏 |
| `hybrid-kit-voices.wav` | 16 个声部依次单击（间隔 1.2 s） |
| `hybrid-kit-params.wav` | 参数 A/B：BD Decay、SD Snappy、LT Tuning、OH/CY Decay |
| `hybrid-kit-manifest.json` | 16 声部映射、采样文件与许可、参数说明、客观检查 |
| `hybrid-kit-spectrogram.png` | demo 的波形 + 频谱图 |
| `../assets/provenance.csv` | 每个 CC0 采样 + 每个合成声部的来源/许可/SHA-256 |

客观检查（不能替代听感）：96 个事件；峰值 -1.01 dBFS、无削波；BD Decay 长短尾能量比 6.8×；
SD Snappy 高频能量比 3.2×；LT Tuning 峰值 66→93 Hz；OH Decay 尾能量比 2.7×；开镲 15/15 被闭镲截断。

## 网页 Demo（可玩）

`../web/` 里是一个可玩的 808 拟真界面 Demo（原创 CSS 重绘，不含 Roland Logo/面板图片/官方采样）：

- 16 步 × 11 通道、Accent、开闭镲 choke、A/B Pattern、4–32 小节 Song Arranger + Loop、Swing、BPM、Tap；
- 音源 = FreePats CC0 采样 + Sonic Pi 的 CC0 `bd_808` + 原创合成声部；
- Hats / Cymbal / Toms 可实时切换 SAMPLE 与 808 合成版，A/B 试听文件见 [web/AB-TEST.md](../web/AB-TEST.md)；
- 3 个风格预设（HOUSE / TRAP / ELECTRO）、localStorage 自动保存、工程 JSON 导出/导入、WAV 离线导出；
- `?selftest=1` 浏览器端 OfflineAudioContext 自测；
- 运行：`cd web; python -m http.server 8137`，打开 http://127.0.0.1:8137/ 。

详见 [web/README.md](../web/README.md)。

## 下一步

1. 用 `hybrid-kit-demo.wav`、`hybrid-kit-voices.wav`、`hybrid-kit-params.wav` 和网页 Demo 做主观试听，确认哪些声部保留采样、哪些改回纯合成。
2. 若方向成立，把 `hybrid_kit.py` 的声部接口与 `808_poc.py` 的调度模型移植为正式引擎，再补 UI 与工程层。
3. 音源路线：自研合成打底；CC0 采样作为备选/补充；更细的免费来源与许可证核查见 [docs/sound-acquisition.zh-CN.md](../docs/sound-acquisition.zh-CN.md)。
