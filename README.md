# Aaron's Org System

本目录是我基于 **Org-mode + Org-roam** 构建的长期个人知识、学习与生活管理系统。

设计目标不是“完美分类”，而是：
- 记录不打断思路
- 整理不伤筋动骨
- 随时间自然演化
- 支撑长期学习、科研与生活


## 一、整体设计理念（先看这个）

本系统明确区分三种不同“时间状态”的信息：

| 模块 | 解决的问题 |
|----|----|
| `daily/` | **今天发生了什么、我当下在想什么** |
| `roam/` | **已经想清楚、值得长期保存的知识与思想** |
| `attachments/` | **外来材料与文件本体（PDF / 图片 / 邮件等）** |

三者分工明确、互不混用。


## 二、目录结构总览

HC/Org
├── attachments/   # 所有非 org 的外部材料
├── daily/         # 按时间记录的日常与临时信息
├── roam/          # 长期知识库（org-roam）
├── diary.org      # 线性私人日记
├── references/    # 统一参考文献（bib / 引用）
├── README.md
└── Icon


## 三、attachments/ —— 外部材料仓库

attachments/
├── CS
├── math
├── QC
├── papers
├── life
├── mail
├── meeting
├── note
├── protocol
├── philosophy
├── inbox
├── index
└── uni

用途说明：
	•	存放 PDF、图片、扫描件、邮件附件、会议材料等
	•	不承载“思考”，只承载“文件本体”
	•	通过 org 链接引用，而不直接在此阅读与整理

原则：
	•	attachments 只作为“仓库”
	•	是否属于哪个主题，以 org 文件为准，而不是文件夹本身

⸻

## 四、daily/ —— 当下记录区（不追求完美）

daily/
├── inbox
├── idea
├── life
├── mail
├── meeting
├── note
├── protocol
└── uni

用途说明：
	•	按“当天/当下”记录信息
	•	不要求结构严谨
	•	允许杂乱、重复、未成熟想法

典型内容：
	•	今天突然想到的点子
	•	临时会议记录
	•	学习过程中的中间态笔记
	•	待整理的信息

工作流原则：

daily 是“写的时候不思考分类”的地方
roam 是“事后想清楚再安放”的地方

⸻

## 五、roam/ —— 长期知识库（核心大脑）

roam/
├── CS
├── math
├── QC
├── philosophy
├── papers
│   └── reference
└── index

用途说明：
	•	存放已经沉淀下来的知识、概念、方法、观点
	•	每个文件都是“可以长期回看的东西”
	•	强依赖双向链接，而非目录层级

原则：
	•	目录只是粗粒度学科划分
	•	具体主题通过：
	•	链接
	•	tags
	•	index 页面
来组织

⸻

## 六、diary.org —— 线性私人记录
	•	不参与 roam
	•	不追求结构化
	•	用于记录情绪、生活片段、长期叙事

这是“只给自己看的时间轴”。

⸻

## 七、references/ —— 引用与学术支撑
	•	统一存放 bib 文件或引用相关资源
	•	服务于：
	•	学术写作
	•	org-cite / LaTeX
	•	papers 笔记

⸻

## 八、使用原则总结（重要）
	1.	记录优先于整理
	2.	daily 允许混乱
	3.	roam 追求清晰
	4.	attachments 只是文件，不是知识
	5.	结构为人服务，而不是反过来


## 九、演化而非定型

本结构不是最终形态，而是一个：
	•	可以增减目录
	•	可以合并拆分
	•	不依赖短期决策的系统

只要不破坏三大分工（daily / roam / attachments），
其余一切都可以随时间自然调整。

⸻

This system is designed to think with me, not to constrain me.





好，这一步问得非常到位。
Tag 一旦定清楚，你这套系统就不会越用越乱。
下面这份是**“可长期使用、不过度设计、与 org-roam 高度兼容”的 Tag 规范**，我已经帮你压到必要且充分的程度。

你可以直接保存为一个 TAG_SPEC.md，或者附在 README 后面。

⸻



# 本规范定义 HC/Org 系统中 **org / org-roam 文件的标签（tag）使用规则**。

目标不是“分类一切”，而是：
- 减少目录层级的依赖
- 强化跨学科链接
- 支撑长期演化而不崩坏

---

## 一、Tag 的基本原则（必须遵守）

### 1. Tag ≠ 目录
- 目录：粗粒度、稳定、很少改
- Tag：细粒度、灵活、可多选

> 当你犹豫“这个该放哪个目录”时，用 tag。

---

### 2. Tag 只回答一个问题
> **“这是一个什么性质的东西？”**

而不是：
- “我现在在干嘛”
- “我在哪门课看到的”

---

### 3. 每个文件的 tag 数量建议 ≤ 5

- 太少：信息不足
- 太多：等于没有

---

## 二、Tag 分类总览（推荐使用集）

所有 tag 统一使用 **小写英文**，必要时用 `-` 连接。

[type]        内容类型
[status]      成熟度 / 状态
[domain]      学科 / 领域
[activity]    行为 / 用途
[property]    额外性质

一个文件不需要覆盖所有类别。

⸻

## 三、[type] 内容类型（必选其一）

用于回答：“这是什么样的东西？”

Tag	含义
concept	概念、定义、术语
theorem	定理、命题、结论
method	方法、技巧、套路
idea	原创或未成熟想法
note	学习笔记 / 摘要
summary	系统性总结
paper	论文级笔记
reference	资料索引
question	尚未解决的问题

示例：

#+filetags: :concept:math:


⸻

## 四、[status] 成熟度 / 状态（可选）

用于回答：“我对它掌握到什么程度？”

Tag	含义
draft	草稿，未稳定
working	正在使用 / 反复回看
stable	内容已稳定
todo	有明确后续动作
review	需要复习
abandoned	已放弃

示例：

#+filetags: :idea:draft:


⸻

## 五、[domain] 学科 / 领域（可选）

用于跨目录检索，而不是替代目录。

Tag	含义
math	数学
cs	计算机科学
qc	量子计算
philosophy	哲学
ml	机器学习
theory	理论取向
applied	应用取向

原则：
如果已经在 roam/math/，可以不打 math tag。

⸻

## 六、[activity] 行为 / 用途（可选）

用于描述**“我用它来干嘛”**。

Tag	含义
learning	学习中
research	科研相关
teaching	教学 / 讲解
writing	写作素材
exam	应试
talk	报告 / 分享


⸻

## 七、[property] 额外性质（谨慎使用）

用于少量重要横向属性。

Tag	含义
core	核心节点
toolbox	常用工具
intuition	直觉解释
formal	严格形式化
example	以例子为主

structure 结构化概念

⸻

## 八、推荐 Tag 组合示例（直接抄）

1️⃣ 数学概念

#+filetags: :concept:math:theory:

2️⃣ 正在读的论文笔记

#+filetags: :paper:research:draft:

3️⃣ 原创想法（未成熟）

#+filetags: :idea:draft:research:

4️⃣ 已稳定的方法总结

#+filetags: :method:stable:toolbox:

5️⃣ 需要回看的问题

#+filetags: :question:review:


⸻

## 九、明确禁止的 Tag 用法（很重要）

❌ 使用时间性 tag

2025 / week3 / today

❌ 使用情绪性 tag

hard / boring / cool

❌ 使用“目录重复型” tag

roam / daily / attachments


⸻

## 十、最终原则（一句话版）

目录负责“住哪”，Tag 负责“你是谁”。

只要遵守这条，你的系统就不会塌。

⸻

This tag system is designed to scale with understanding, not with volume.


