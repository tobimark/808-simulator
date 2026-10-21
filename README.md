# 808 Simulator

808 风格鼓机项目：调研 → 音源与许可证核查 → 声音/时序原型 → 混合音源 → 可玩网页 Demo。
<img width="1574" height="844" alt="screenshot" src="https://github.com/user-attachments/assets/6691a968-83e0-4318-b709-161b05947672" />

## 现在有什么

| 目录 / 文件 | 内容 |
| --- | --- |
| `docs/ios-808-research.zh-CN.md` | iOS 808 App 的产品与技术调研（309 行，含 44 个来源） |
| `docs/sound-acquisition.zh-CN.md` | 免费音源、许可证核查、可打包/不可打包清单与留证流程 |
| `prototype/808_poc.py` | 13 声部纯合成 + 采样级音序 POC、分析图与试听 WAV |
| `prototype/hybrid_kit.py` | 16 声部 / 11 通道混合音源（CC0 采样 + 原创合成） |
| `web/` | **可玩的 808 拟真网页 Demo**：16 步音序、Accent、choke、A/B Pattern、4–32 小节 Song Arranger、Loop 区间、音色 A/B、自动保存 + JSON 导入导出、WAV 导出；内置 HOUSE / TRAP / ELECTRO 三个风格 |
| `assets/` | 采样来源/许可/SHA-256 记录 |

## 运行网页 Demo

```powershell
cd web
python -m http.server 8137
```

打开 <http://127.0.0.1:8137/>。也可以直接打开 `web/index.html`。

详细操作、音源说明、自测结果与限制见 [web/README.md](web/README.md)。

## 音源与权利

- 采样：FreePats Synthesizer Percussion（CC0 1.0）+ Sonic Pi `bd_808`（原 Freesound EKVelika #208447，CC0）。
- 合成声部：本项目原创代码。
- 界面为参考 808 面板布局的原创 CSS 重绘；没有使用 Roland 的 Logo、面板图片、官方采样或 ROM 数据。
- "808" 仅作描述性使用，本项目与 Roland 无隶属关系。

## 状态

这是原型/Demo，不是可上架产品。未做真机 iOS 验证、未做人耳盲听验收；网页端已有 4–32 小节 Song Arranger、Loop、本地保存、JSON 导入导出和 Hats/Cymbal/Toms 的 A/B 音色试听文件，但还没有多工程管理、每小节独立 Pattern、AUv3 或 MIDI。音色 A/B 见 [web/AB-TEST.md](web/AB-TEST.md)。
