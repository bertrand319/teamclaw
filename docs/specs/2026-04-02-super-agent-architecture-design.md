# Super Agent Architecture Design

> 通过 P2P 连接的 Agent 网络，从"共享文件"进化为"集体智能"

## 1. Overview

### 1.1 Problem Statement

TeamClaw 当前通过 iroh P2P 和阿里云 OSS 实现了 Agent 之间的技能、知识库和 MCP 配置同步。但这种协作停留在**静态资产共享**层面——Agent 之间没有运行时交互，无法：

- 将不擅长的任务委托给更合适的 Agent
- 从彼此的成功和失败中学习
- 对复杂问题进行集体推理和决策

### 1.2 Vision

构建一个 **Super Agent（超级智能体）**——不是一个单一的大模型，而是一个由多个 Agent 组成的网络，通过协议层实现：

1. **任务分发与协作**：Agent 自动发现并委托任务给最合适的节点
2. **集体学习与进化**：所有 Agent 的经验汇聚，网络整体越来越聪明
3. **涌现式推理**：多 Agent 从不同角度思考同一问题，通过辩论和投票产生超越个体的决策

### 1.3 Design Decisions

| 维度 | 决策 | 理由 |
|------|------|------|
| 架构策略 | 架构先行 | 先定义完整协议层，再逐步实现上层能力 |
| 架构模式 | Hive Mind + Blackboard 混合 | 黑板做持久化状态共享，Nerve Channel 做实时事件广播 |
| 信任模型 | 团队内部强信任（Phase 1），未来扩展为分层联邦 | 降低初始复杂度，先在强信任场景验证 |
| 经验共享粒度 | 多层级 | 默认策略级，关键经验自动提炼为技能，会话按需查看 |
| 决策模式 | 民主投票（Ranked Choice Voting） | 公平、无需指定主脑、天然适配 CRDT |

### 1.4 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Super Agent (逻辑视图)                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │           Layer 4: Emergent Intelligence         │    │
│  │     涌现层 — 多Agent辩论、投票、融合推理           │    │
│  ├─────────────────────────────────────────────────┤    │
│  │           Layer 3: Collective Learning           │    │
│  │     集体学习层 — 经验汇聚、策略提炼、技能进化       │    │
│  ├─────────────────────────────────────────────────┤    │
│  │           Layer 2: Task Orchestration            │    │
│  │     任务编排层 — 任务分发、能力发现、协作执行       │    │
│  ├─────────────────────────────────────────────────┤    │
│  │           Layer 1: Neural Fabric                 │    │
│  │     神经织网层 — 通信基础设施                      │    │
│  │                                                  │    │
│  │   ┌──────────────┐    ┌───────────────────┐     │    │
│  │   │ Nerve Channel │    │    Blackboard      │     │    │
│  │   │ (iroh-gossip) │    │   (Loro CRDT Docs) │     │    │
│  │   │               │    │                    │     │    │
│  │   │ 实时广播/事件  │    │ 持久化共享状态      │     │    │
│  │   │ 毫秒级延迟     │    │ 最终一致性          │     │    │
│  │   │ Fire & Forget │    │ 完整历史可追溯      │     │    │
│  │   └──────────────┘    └───────────────────┘     │    │
│  │          ↑                      ↑                │    │
│  │          └──── iroh P2P + OSS Sync ────┘        │    │
│  ├─────────────────────────────────────────────────┤    │
│  │           Layer 0: Identity & Capability         │    │
│  │     身份与能力注册层 — Agent 身份、能力声明、发现    │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│  │ Agent A  │ │ Agent B  │ │ Agent C  │ │ Agent D  │     │
│  │ (前端)   │ │ (数据)   │ │ (运维)   │ │ (测试)    │     │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘     │
└─────────────────────────────────────────────────────────┘
```

**核心双轨设计原则**：

| | Nerve Channel | Blackboard |
|---|---|---|
| **载体** | iroh-gossip (pub/sub) | Loro CRDT Docs (via iroh-docs) |
| **语义** | "发生了什么"（事件） | "世界是什么样"（状态） |
| **时效** | 实时，毫秒级 | 最终一致，秒级 |
| **持久性** | 瞬时，不持久化 | 永久，完整历史 |
| **用途** | 任务广播、心跳、紧急协调 | 任务状态、经验库、投票记录 |
| **类比** | 神经脉冲 | 大脑皮层记忆 |

**Nerve 通知，Blackboard 存真**：任何 Agent 错过了一个 Nerve 事件，总能从 Blackboard 上恢复完整状态。这保证了系统在部分节点离线时仍然正确。

---

## 2. Layer 0: Identity & Capability Registry

### 2.1 Agent Profile

每个 Agent 加入网络时，自动生成并广播一个 Agent Profile：

```typescript
interface AgentProfile {
  // === 身份 ===
  nodeId: string           // iroh Ed25519 公钥，全局唯一
  name: string             // 人类可读名称，如 "Matt's Frontend Agent"
  owner: string            // 所属用户 ID

  // === 能力声明 ===
  capabilities: Capability[]

  // === 状态 ===
  status: 'online' | 'busy' | 'idle' | 'offline'
  currentTask?: string     // 当前正在执行的任务摘要
  lastHeartbeat: number    // Unix timestamp

  // === 元数据 ===
  version: string          // Agent 软件版本
  modelId: string          // 底层 LLM 模型标识
  joinedAt: number         // 加入团队时间
}
```

### 2.2 Capability

能力不是静态标签，而是可验证的结构化声明：

```typescript
interface Capability {
  domain: string           // 能力域，如 "frontend", "database", "devops"
  skills: string[]         // 具体技能 ID，对应已安装的 SKILL.md
  tools: string[]          // 可用的 MCP 工具列表
  languages: string[]      // 擅长的编程语言

  // === 动态指标（由 Layer 3 集体学习层回填）===
  confidence: number       // 0-1，基于历史任务成功率
  taskCount: number        // 该领域已完成任务数
  avgScore: number         // 平均 session scoring 分数
}
```

### 2.3 Registry Storage

注册表是一个 Loro CRDT Map，存在 Blackboard 上：

```
blackboard/
  └── registry.loro
        ├── agents/       # Map<nodeId, AgentProfile>
        ├── capabilities/ # 倒排索引 Map<domain, nodeId[]>
        └── heartbeats/   # Map<nodeId, timestamp>
```

### 2.4 Lifecycle Events

| 事件 | Nerve Channel（实时） | Blackboard（持久） |
|------|----------------------|-------------------|
| Agent 上线 | 广播 `AgentJoin` | 写入 Profile 到 registry |
| 心跳 | 每 15s 广播 `Heartbeat` | 更新 heartbeats map |
| 能力变化 | 广播 `CapabilityUpdate` | 更新 capabilities 倒排索引 |
| Agent 下线 | 广播 `AgentLeave`（尽力） | 其他节点检测超时后标记 offline |
| 能力指标更新 | 不广播（非紧急） | Layer 3 定期回填 confidence/score |

### 2.5 Capability Discovery

当上层需要找到"谁能做这件事"时：

```
1. 查 Blackboard registry/capabilities 倒排索引
2. 按 confidence × avgScore 加权排序
3. 过滤掉 status != 'online' 的节点
4. 返回 Top-K 候选 Agent 列表
```

---

## 3. Layer 1: Neural Fabric

### 3.1 Nerve Channel Protocol

基于 iroh-gossip 的 topic-based pub/sub，定义 5 个 Topic：

```
nerve/
  ├── heartbeat     # 心跳与存活检测
  ├── task          # 任务广播、竞标、分配
  ├── experience    # 经验分享通知
  ├── debate        # 辩论发起与投票通知
  └── emergency     # 紧急协调（中断任务、回滚等）
```

### 3.2 Unified Message Envelope

```typescript
interface NerveMessage {
  id: string              // ULID，天然有序
  topic: NerveTopic       // 5 个 topic 之一
  from: string            // 发送者 nodeId
  timestamp: number       // 发送时间
  ttl: number             // 消息存活时间（秒），过期丢弃
  payload: NervePayload   // 具体载荷
}
```

### 3.3 Payload Definitions

```typescript
// --- heartbeat ---
interface HeartbeatPayload {
  type: 'heartbeat'
  status: 'online' | 'busy' | 'idle'
  currentTask?: string
  load: number            // 0-1，当前负载
}

// --- task ---
interface TaskBroadcastPayload {
  type: 'task:broadcast'
  taskId: string
  description: string
  requiredCapabilities: string[]
  urgency: 'low' | 'normal' | 'high' | 'critical'
}

interface TaskBidPayload {
  type: 'task:bid'
  taskId: string
  confidence: number
  estimatedTokens: number
}

interface TaskAssignPayload {
  type: 'task:assign'
  taskId: string
  assignee: string
}

interface TaskProgressPayload {
  type: 'task:progress'
  taskId: string
  parentTaskId?: string
  progress: number          // 0-100
  message: string
}

interface TaskHandoffPayload {
  type: 'task:handoff'
  taskId: string
  from: string
  to: string
  context: string
}

// --- experience ---
interface ExperiencePayload {
  type: 'experience:new'
  experienceId: string
  domain: string
  summary: string
}

// --- debate ---
interface DebatePayload {
  type: 'debate:propose' | 'debate:vote' | 'debate:conclude'
  debateId: string
}

// --- emergency ---
interface EmergencyPayload {
  type: 'emergency:abort' | 'emergency:rollback' | 'emergency:alert'
  taskId?: string
  reason: string
}
```

### 3.4 Blackboard Structure

4 个独立的 Loro Doc，各自通过 P2P/OSS 通道同步：

```
blackboard/
  ├── registry.loro       # Layer 0: Agent 身份与能力
  ├── taskboard.loro      # Layer 2: 任务全生命周期状态
  ├── knowledge.loro      # Layer 3: 经验库（策略 + 技能）
  └── debates.loro        # Layer 4: 辩论与投票记录
```

### 3.5 Nerve ↔ Blackboard Coordination

关键原则：**Nerve 通知，Blackboard 存真**。

```
发起任务的完整流程：

Agent A                    Nerve Channel              Blackboard
   │                            │                         │
   ├─── task:broadcast ────────►│                         │
   │                            │                         │
   ├──────────────────── 同时写入 Task(status=open) ─────►│
   │                            │                         │
   │◄─── task:bid (Agent B) ────┤                         │
   │◄─── task:bid (Agent C) ────┤                         │
   │                            │         各 bid 也写入    │
   │                            │         Task.bids ─────►│
   │                            │                         │
   │  [选出最优 bidder]          │                         │
   │                            │                         │
   ├─── task:assign ───────────►│                         │
   ├──────────────────── Task(status=assigned) ──────────►│
```

**容错**：
- Agent 错过 Nerve 事件 → 下次心跳扫描 Blackboard 上 `status=open` 的任务
- Blackboard 同步延迟 → Nerve 事件携带足够信息让 Agent 先行动，后补状态
- 发起者掉线 → 其他 Agent 检测到 creator offline + task 无人 assign，触发 `emergency:alert`

---

## 4. Layer 2: Task Orchestration

### 4.1 Task Classification

```typescript
enum TaskComplexity {
  SOLO = 'solo',                 // 单 Agent 直接执行
  DELEGATE = 'delegate',         // 找最合适的 Agent 执行
  PARALLEL = 'parallel',         // 多 Agent 并行执行子任务
  ORCHESTRATED = 'orchestrated', // 有依赖的子任务编排
  DELIBERATE = 'deliberate'      // 需要多 Agent 辩论（触发 Layer 4）
}
```

**自动分类逻辑**（由发起 Agent 的 LLM 判断）：

```
用户输入 → Agent 分析任务 → 判断：
  ├─ 我能独立完成？              → SOLO，本地执行
  ├─ 我不擅长但有人擅长？         → DELEGATE
  ├─ 任务可拆分为独立子任务？      → PARALLEL
  ├─ 子任务有先后依赖？           → ORCHESTRATED
  └─ 任务有争议/需要多角度？      → DELIBERATE
```

### 4.2 Task Lifecycle State Machine

```
                    ┌──── timeout ────┐
                    ▼                 │
 ┌──────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐
 │ DRAFT │───►│   OPEN   │───►│ BIDDING  │───►│ASSIGNED │
 └──────┘    └──────────┘    └──────────┘    └────┬────┘
                  │                                │
                  │ (SOLO: 跳过竞标)                 │
                  │                          ┌─────▼─────┐
                  └─────────────────────────►│  RUNNING   │
                                             └─────┬─────┘
                                                   │
                                    ┌──────────────┼──────────────┐
                                    ▼              ▼              ▼
                              ┌──────────┐  ┌──────────┐  ┌──────────┐
                              │COMPLETED │  │  FAILED  │  │ ABORTED  │
                              └─────┬────┘  └─────┬────┘  └──────────┘
                                    │             │
                                    ▼             ▼
                              ┌──────────────────────┐
                              │  EXPERIENCE_CAPTURED  │
                              │  (触发 Layer 3 学习)   │
                              └──────────────────────┘
```

### 4.3 Bidding Protocol

```typescript
interface BiddingConfig {
  windowMs: number           // 竞标窗口，默认 5000ms
  minBids: number            // 最少 bid 数，默认 1
  weights: {
    confidence: number       // Agent 自评信心 (0.3)
    capability: number       // 历史能力评分   (0.4)
    load: number             // 当前负载       (0.2)
    tokenEfficiency: number  // token 效率     (0.1)
  }
}
```

**评分公式**：

```
BidScore = w_conf × confidence
         + w_cap  × capability_score
         + w_load × (1 - current_load)
         + w_tok  × (1 / normalized_estimated_tokens)
```

**分配规则**：
- 竞标窗口关闭后，BidScore 最高者中标
- 平分时，`taskCount` 更低者优先（负载均衡）
- 无人竞标 → 发起者自己执行，或降低要求重新广播

### 4.4 TaskBoard Data Structure

```typescript
interface TaskBoard {
  tasks: Map<taskId, Task>
  dags: Map<rootTaskId, DAGView>
}

interface Task {
  id: string
  creator: string
  description: string
  requiredCapabilities: string[]
  urgency: 'low' | 'normal' | 'high' | 'critical'

  status: 'open' | 'bidding' | 'assigned' | 'running'
        | 'reviewing' | 'completed' | 'failed' | 'aborted'

  bids: Map<nodeId, {
    confidence: number
    estimatedTokens: number
    timestamp: number
  }>

  assignee?: string
  result?: {
    summary: string
    sessionId: string
    tokensUsed: number
    score: number
  }

  createdAt: number
  updatedAt: number
}
```

### 4.5 Composite Task DAG (PARALLEL / ORCHESTRATED)

```typescript
interface TaskDAG {
  rootTaskId: string
  nodes: Map<subtaskId, SubTask>
  edges: Array<{
    from: string
    to: string
    type: 'data' | 'completion'
  }>
}

interface SubTask extends Task {
  parentTaskId: string
  depth: number
  inputs: Map<string, any>
  outputs: Map<string, any>
}

interface DAGView {
  dag: TaskDAG
  progress: {
    total: number
    completed: number
    running: number
    failed: number
  }
  startedAt: number
  estimatedCompletion?: number
}
```

**DAG Scheduler**（运行在发起 Agent 上）：

```typescript
class DAGScheduler {
  getReadyTasks(dag: TaskDAG): SubTask[]
  dispatch(task: SubTask): void
  onSubTaskComplete(subtaskId: string, result: TaskResult): void
  onSubTaskFailed(subtaskId: string, error: Error): void
}
```

---

## 5. Layer 3: Collective Learning

### 5.1 Three-Level Experience Pyramid

```
          ▲
         ╱ ╲        技能 (Skill)
        ╱Few╲       高度提炼，可直接执行
       ╱─────╲
      ╱Medium ╲     策略 (Strategy)
     ╱─────────╲    结构化经验
    ╱   Many    ╲   原始经验 (Experience)
   ╱─────────────╲  每次任务后自动采集
```

**流转规则**：
- 原始经验：每个任务完成后自动生成，留存 30 天
- 策略：同一 domain 积累 ≥ 3 条相似经验时自动归纳
- 技能：策略被 ≥ 2 个 Agent 验证有效且 avgScore ≥ 0.7 时自动蒸馏为 SKILL.md

### 5.2 Experience Collection

```typescript
interface Experience {
  id: string

  // === 来源 ===
  agentId: string
  taskId: string
  sessionId: string

  // === 分类 ===
  domain: string
  tags: string[]
  outcome: 'success' | 'failure' | 'partial'

  // === 结构化经验（CAR-L 格式）===
  context: string            // "遇到了什么情况"
  action: string             // "采取了什么行动"
  result: string             // "产生了什么结果"
  lesson: string             // "学到了什么"

  // === 量化指标 ===
  metrics: {
    tokensUsed: number
    duration: number
    toolCallCount: number
    score: number
    retryCount: number
  }

  createdAt: number
  expiresAt: number           // 默认 30 天，被提炼为策略后永久保留
}
```

**采集管线**：

```
任务完成/失败
    │
    ▼
Agent LLM 分析会话 → 提取 context/action/result/lesson + 标签
    │
    ▼
写入 Blackboard knowledge.loro
    │
    ▼
Nerve 广播 experience:new（仅摘要）
    │
    ▼
触发策略引擎检查是否可归纳
```

### 5.3 Strategy Distillation Engine

```typescript
interface Strategy {
  id: string
  domain: string
  tags: string[]

  type: 'recommend' | 'avoid' | 'compare'
  condition: string           // "当..."
  recommendation: string      // "推荐... / 避免... / A vs B"
  reasoning: string

  evidence: {
    sourceExperiences: string[]
    successRate: number
    sampleSize: number
    contributingAgents: string[]
    confidenceInterval: number
  }

  validation: {
    status: 'proposed' | 'testing' | 'validated' | 'deprecated'
    validatedBy: string[]
    validationScore: number
  }

  createdAt: number
  updatedAt: number
}
```

**归纳算法**：

```
1. 按 domain 分组未归纳的 Experience
2. 按 tags 二次聚类
3. 对每个聚类（≥ 3 条经验）：
   ├─ 成功占比 > 70% → 正向策略："推荐 [action 共性]"
   ├─ 失败占比 > 50% → 避坑策略："避免 [action 共性]"
   └─ 混合           → 对比策略："A 成功率 X% vs B 成功率 Y%"
```

### 5.4 Skill Distillation (Strategy → SKILL.md)

**触发条件**：

```
✓ strategy.validation.status === 'validated'
✓ strategy.validation.validatedBy.length >= 2
✓ strategy.evidence.confidenceInterval >= 0.7
✓ strategy.evidence.sampleSize >= 5
```

**蒸馏流程**：

```
已验证 Strategy
    │
    ▼
LLM 生成 SKILL.md：
    ├─ condition → 触发条件描述
    ├─ recommendation → 执行指令
    ├─ reasoning → 背景说明
    └─ evidence 摘要 → 可信度参考
    │
    ▼
写入 knowledge.loro (distilledSkills)
    │
    ▼
同步到团队 skills/ 目录（现有 P2P/OSS 通道）
    │
    ▼
所有 Agent 自动发现并可使用
```

**蒸馏产物示例**：

```markdown
---
name: react-state-lifting
description: 当多组件共享状态时，优先用状态提升而非 Context
source: collective-learning
confidence: 0.85
sample_size: 12
contributors: [agent-a, agent-b, agent-c]
---

# React 状态共享策略

## 触发条件
当你遇到多个兄弟组件需要共享状态的场景时应用此技能。

## 推荐做法
优先将状态提升到最近公共父组件，而非引入 React Context。

## 原因
团队 12 次实践表明，状态提升方案优于 Context：
- Token 消耗平均降低 23%
- 首次成功率 89% vs 62%
- 后续修改复杂度更低

## 例外
共享层级超过 3 层时，Context 仍是更优选择。
```

### 5.5 Capability Feedback Loop (→ Layer 0)

```
Strategy validated → 更新相关 Agent 的 Capability：
    ├─ confidence: 基于该 domain 成功率重算
    ├─ avgScore: 滑动窗口平均分
    └─ taskCount: +1

Skill distilled → 更新所有采用者的 capabilities.skills[]
```

正反馈循环：

```
任务执行 → 经验采集 → 策略归纳 → 技能蒸馏
    ▲                                    │
    │         能力更新 → 更好的任务分配     │
    └────────────────────────────────────┘
```

---

## 6. Layer 4: Emergent Intelligence

### 6.1 Three Modes of Emergence

```
┌─────────────┐ ┌──────────────┐ ┌──────────────┐
│ Perspective  │ │   Debate     │ │  Synthesis   │
│ Gathering    │ │   Protocol   │ │  Engine      │
│ 多视角采集    │ │  结构化辩论   │ │  融合决策     │
└──────┬──────┘ └──────┬───────┘ └──────┬───────┘
       └───────────────┴────────────────┘
               Gather → Debate → Synthesize
```

### 6.2 Deliberation Trigger

```typescript
interface DeliberationTrigger {
  explicit: boolean              // Layer 2 分类为 DELIBERATE

  auto: {
    isArchitecturalDecision: boolean
    creatorConfidence: number    // < 0.5 时触发
    domainFailureRate: number   // > 0.4 时触发
    crossDomainCount: number    // >= 2 时触发
  }
}
```

### 6.3 Phase 1: Perspective Gathering

```typescript
interface PerspectiveRequest {
  debateId: string
  question: string
  context: string
  constraints: string[]
  deadline: number
  requestedAngles: Angle[]
}

enum Angle {
  FEASIBILITY = 'feasibility',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  MAINTAINABILITY = 'maintainability',
  USER_EXPERIENCE = 'user_experience',
  COST = 'cost',
  RISK = 'risk'
}

interface Perspective {
  debateId: string
  agentId: string
  angle: Angle

  position: string
  reasoning: string
  evidence: string[]
  risks: string[]

  preferredOption?: string
  optionRanking?: Array<{
    option: string
    score: number            // 0-10
    reason: string
  }>

  confidence: number
}
```

**采集规则**：
- 广播 `debate:propose` 到 Nerve Channel
- 等待：`deadline` 或 ≥ 3 个视角（取先到者）
- Agent 根据自身 Capability 自动选择最匹配的 Angle
- 同一 Agent 可从多个 Angle 回应

### 6.4 Phase 2: Debate Protocol

最多 3 轮结构化辩论：

```typescript
interface DebateRound {
  round: number              // 1, 2, 3
  responses: Map<agentId, DebateResponse>
}

interface DebateResponse {
  agentId: string

  rebuttals: Array<{
    targetAgentId: string
    targetClaim: string
    response: 'agree' | 'disagree' | 'partially_agree'
    argument: string
    newEvidence?: string
  }>

  updatedPosition?: string
  updatedConfidence: number
  readyToConverge: boolean
}
```

**终止条件**（满足任一）：
1. 所有 Agent `readyToConverge === true`
2. 达到最大轮数（3 轮）
3. 超过时间限制
4. 超级多数（> 2/3 Agent 持相同立场）

### 6.5 Phase 3: Synthesis & Voting

```typescript
interface SynthesisProcess {
  debateId: string

  candidateOptions: Array<{
    id: string
    description: string
    synthesizedFrom: string[]
    pros: string[]
    cons: string[]
  }>

  votes: Map<agentId, Vote>
  result: {
    winningOptionId: string
    winningDescription: string
    votingRounds: number       // RCV 经历了几轮
    margin: number             // 胜出比例 (0-1)
    dissent: string[]          // 少数派的关键反对意见（保留备查）
  }
}

interface Vote {
  agentId: string
  preferredOptionId: string

  ranking: Array<{
    optionId: string
    rank: number
  }>

  confidence: number
  finalReasoning: string
}
```

**Ranked Choice Voting 算法**：

```
Round 1: 统计每个选项的第一选择票数
    ├─ 某选项 > 50%？→ 胜出
    └─ 无多数？→ 淘汰最少票选项，按第二选择重分配
         ├─ 某选项 > 50%？→ 胜出
         └─ 继续淘汰...直到产生多数
```

### 6.6 Complete Deliberation Flow

```
触发 Deliberation
    │
    ▼
Phase 1: Perspective Gathering (10-30s)
    Nerve: debate:propose
    等待: deadline 或 ≥3 视角
    Blackboard: debates.loro 写入视角
    │
    ├─ 无分歧 → 直接进 Phase 3
    └─ 有分歧 ↓
    │
Phase 2: Debate (30-90s)
    最多 3 轮
    Nerve: debate:vote 通知
    Blackboard: 记录每轮辩论
    │
    ▼
Phase 3: Synthesis & Voting (10-20s)
    方案融合 → Ranked Choice Voting
    Nerve: debate:conclude
    Blackboard: 完整决策记录
    │
    ├─► 交回 Layer 2 执行
    └─► 交给 Layer 3 记录为经验
```

### 6.7 Debate Record & Post-Decision Learning

```typescript
interface DebateRecord {
  id: string
  question: string
  trigger: DeliberationTrigger

  perspectives: Perspective[]
  rounds: DebateRound[]
  synthesis: SynthesisProcess

  participants: string[]
  duration: number
  consensusReached: boolean
  finalDecision: string

  // 决策后果回填（任务执行完成后）
  postDecisionOutcome?: {
    taskId: string
    actualResult: string
    score: number
    wasCorrectDecision: boolean
  }

  createdAt: number
}
```

`postDecisionOutcome` 形成决策学习闭环：下次类似辩论时，Layer 3 可引用"上次选了 A，结果证明是对的/错的"。

---

## 7. Evolution Roadmap

### Phase 1: 基础神经系统 (Month 1-2)

**目标**：Agent 能"看见"彼此、"听见"彼此。

```
交付物：
├─ L0: AgentProfile + Capability 声明
├─ L0: Registry Loro Doc + 倒排索引
├─ L0: 心跳机制 + 在线状态检测
├─ L1: NerveMessage 统一信封
├─ L1: heartbeat + emergency 两个 Topic
├─ L1: Blackboard 基础结构（registry.loro）
└─ 前端：Agent 网络拓扑可视化

验收标准：
✓ 打开 TeamClaw，能看到团队所有在线 Agent
✓ 每个 Agent 显示能力标签和当前状态
✓ Agent 掉线 30s 内其他节点能感知
```

### Phase 2: 任务协作网络 (Month 2-3)

**目标**：Agent 能把任务交给更合适的 Agent。

```
依赖：Phase 1

交付物：
├─ L1: task Topic (broadcast/bid/assign/progress)
├─ L1: taskboard.loro
├─ L2: 任务分类器 (SOLO / DELEGATE)
├─ L2: 竞标协议 + 评分公式
├─ L2: 任务生命周期状态机
└─ 前端：任务看板

验收标准：
✓ Agent A 遇到不擅长的任务，自动广播
✓ 最合适的 Agent 中标并执行
✓ 全过程在看板上可追踪

暂不实现：PARALLEL / ORCHESTRATED
```

### Phase 2.5: 复合任务编排 (可选加速)

```
交付物：
├─ L2: TaskDAG + DAG Scheduler
├─ L2: PARALLEL + ORCHESTRATED 模式
├─ L2: TaskHandoff 交接协议
└─ 前端：DAG 可视化
```

### Phase 3: 集体记忆体 (Month 4-5)

**目标**：网络积累和提炼集体智慧。

```
依赖：Phase 2

交付物：
├─ L1: experience Topic + knowledge.loro
├─ L3: Experience 自动采集管线
├─ L3: Strategy 归纳引擎
├─ L3: Skill 蒸馏管线 → SKILL.md
├─ L0: 能力回填机制
└─ 前端：知识图谱浏览器

验收标准：
✓ 任务完成后自动生成结构化经验
✓ 3+ 条同类经验后自动归纳策略
✓ 策略验证后自动蒸馏为团队共享技能
✓ 能力评分基于真实表现动态更新
```

### Phase 4: 涌现心智 (Month 6-7)

**目标**：多 Agent 集体思考，超越个体。

```
依赖：Phase 3

交付物：
├─ L1: debate Topic + debates.loro
├─ L4: DeliberationTrigger
├─ L4: Perspective Gathering
├─ L4: Debate Protocol (最多 3 轮)
├─ L4: Ranked Choice Voting
├─ L4: Synthesis Engine
├─ L3: postDecisionOutcome 回溯闭环
└─ 前端：辩论可视化

验收标准：
✓ 架构决策自动触发多 Agent 辩论
✓ 各 Agent 从不同角度交锋
✓ 投票产生最终决策，完整辩论记录
✓ 决策后果回填，形成学习闭环
```

### Milestone Summary

```
Month 1-2     Month 2-3      Month 4-5       Month 6-7
────────────────────────────────────────────────────────►

Phase 1       Phase 2        Phase 3         Phase 4
基础神经系统    任务协作        集体记忆体       涌现心智

"能看见彼此"  "能协作干活"   "能积累智慧"    "能集体思考"

单个 Agent ─► 协作 Agents ─► 学习型网络 ─►  超级智能体
```

---

## 8. Future Considerations

以下能力不在当前设计范围内，但架构已预留扩展空间：

- **跨团队弱信任联邦**：Layer 0 的 AgentProfile 可扩展信任评分，Layer 1 可增加加密通道，Blackboard 可按权限分区
- **人类参与节点**：团队成员可作为特殊 Agent 参与辩论和投票，权重可单独配置
- **快速投票模式**：跳过 Debate 阶段，直接从 Perspective 进入 Voting，适用于低风险决策
- **经验市场**：跨团队的策略/技能交换，基于声誉机制定价
