# 808 Web Demo — 人耳 A/B 试听指南

> 这些 A/B 文件由代码渲染生成；**我没有耳朵/监听设备，无法判断哪一版更接近原机**。
> 下面的文件用于让你在两个版本之间做同 Pattern、同 BPM、尽量同响度的直接对比。

## 先听什么

建议戴耳机，音量一致，按顺序听。每对先听 **sample** 再听 **808**（或反过来再听一遍）。

| 组 | A（采样） | B（808 合成） | 重点听什么 |
| --- | --- | --- | --- |
| HATS | `ab-hats-sample.wav` | `ab-hats-808.wav` | 金属感、起音、闭镲短促度、开镲尾音、刺耳程度 |
| CYMBAL | `ab-cymbal-sample.wav` | `ab-cymbal-808.wav` | 金属泛音、长尾、是否像 808 的“叮”而不是通用 crash |
| TOMS | `ab-toms-sample.wav` | `ab-toms-808.wav` | 音高下坠、鼓身厚度、衰减长度、低音是否够 |
| 整段 House | `ab-all-sample.wav` | `ab-all-808.wav` | 在完整节奏里，金属组是否过亮/过薄，toms fill 是否自然 |

这些隔离文件都使用固定 Pattern：

- HATS：只含闭镲 1/3、开镲反拍，没有鼓；
- CYMBAL：每小节 1 个镲；
- TOMS：只有 low/mid/high toms，按 0/4/8/12 等步进；
- 整段：HOUSE 4 小节 A A A B。

## 在网页里实时切

打开 <http://127.0.0.1:8137/>，顶部 **VOICE A/B**：

- HATS: `SAMPLE` / `808 METAL`
- CYMBAL: `SAMPLE` / `808 METAL`
- TOMS: `SAMPLE` / `808 SYNTH`

默认是 808 合成版；切到 SAMPLE 即可实时对比。键盘空格开始/停止。

## 建议你反馈的 6 个问题

1. HATS 的 808 版是否太亮/太细，还是比采样更接近记忆中的 808？
2. CYMBAL 的 808 版是否更像 808 的长金属尾？会不会太响？
3. TOMS 的 808 版低音够不够、pitch drop 是否自然？
4. 在整段 House 里，808 金属组是否让 mix 变得刺耳？
5. 哪一组应该保持 SAMPLE、哪一组应该换成 808 合成？
6. 如果只能选一个方向：更接近原机 vs 更“好听好混”，你选哪个？

## 客观数据（不是好坏判断）

| 对比 | Peak | RMS | >6 kHz | <100 Hz |
| --- | --- | --- | --- | --- |
| Hats sample | 0.202 | -37.04 dBFS | 80.4% | 0% |
| Hats 808 | 0.123 | -37.77 dBFS | 86.2% | 0% |
| Cymbal sample | 0.330 | -35.38 dBFS | 41.5% | 0% |
| Cymbal 808 | 0.150 | -35.48 dBFS | 81.8% | 0% |
| Toms sample | 0.355 | -25.07 dBFS | 10.0% | 22.2% |
| Toms 808 | 0.290 | -24.49 dBFS | 13.8% | 8.7% |
| All sample | 0.951 | -9.71 dBFS | 23.6% | 25.5% |
| All 808 | 0.947 | -9.68 dBFS | 35.0% | 23.0% |

A/B 文件由 `node web/render_ab.mjs` 生成，数据在 `web/ab-report.json`。
