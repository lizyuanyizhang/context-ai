/**
 * FSRS 间隔重复算法调度器
 *
 * 基于学界验证的 FSRS (Free Spaced Repetition Scheduler) 算法，
 * 相比固定间隔（如 1→6→15 天）能根据内容难度动态调整复习间隔。
 * 参考：https://github.com/open-spaced-repetition/ts-fsrs
 *
 * 映射关系：
 * - 不认识 → Again（短期复习，约 1 分钟）
 * - 认识   → Good（正常间隔）
 * - 已掌握 → Easy（较长间隔）
 */

import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  TypeConvert,
  type Card,
  type CardInput,
  type RecordLogItem,
  type Grade
} from 'ts-fsrs'

/** 我方评分类型：与 MasteryStatus 对应，用于 UI 按钮 */
export type OurRating = 'again' | 'good' | 'easy'

/** 存储用：Card 的序列化格式（Date 转时间戳） */
export interface StoredFSRSCard {
  due: number
  stability: number
  difficulty: number
  state: number
  reps: number
  lapses: number
  last_review?: number
  scheduled_days?: number
  learning_steps?: number
}

/** OurRating → FSRS Grade */
const RATING_MAP: Record<OurRating, Grade> = {
  again: Rating.Again,
  good: Rating.Good,
  easy: Rating.Easy
}

/**
 * 创建 FSRS 实例（启用短期学习步长，便于「不认识」后快速复习）
 */
const scheduler = fsrs(
  generatorParameters({
    enable_fuzz: true,
    enable_short_term: true,
    request_retention: 0.9,
    maximum_interval: 365
  })
)

/**
 * 将 WordbookEntry 中的存储数据转为 FSRS Card
 */
export function storedCardToFSRS(stored: StoredFSRSCard | null | undefined): Card {
  if (!stored) {
    return createEmptyCard(new Date())
  }

  const now = Date.now()
  const lastReview = stored.last_review ?? stored.due
  const elapsedDays = Math.max(0, Math.floor((now - lastReview) / (24 * 60 * 60 * 1000)))

  const input: CardInput = {
    due: stored.due,
    stability: stored.stability,
    difficulty: stored.difficulty,
    state: stored.state as CardInput['state'],
    reps: stored.reps,
    lapses: stored.lapses,
    last_review: stored.last_review ?? undefined,
    scheduled_days: stored.scheduled_days ?? 0,
    learning_steps: stored.learning_steps ?? 0,
    elapsed_days: elapsedDays
  }

  // 使用 TypeConvert 确保格式正确，供 FSRS 使用
  return TypeConvert.card(input)
}

/**
 * 将 FSRS Card 转为可存储格式
 */
export function fsrsCardToStored(card: Card): StoredFSRSCard {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    state: card.state,
    reps: card.reps,
    lapses: card.lapses,
    last_review: card.last_review?.getTime(),
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps
  }
}

/**
 * 根据用户评分计算下一次复习时间
 *
 * @param stored 当前存储的 FSRS 状态，新词可传 null
 * @param rating 用户选择的评分
 * @returns 新的存储状态 + 下次复习时间戳（毫秒）
 */
export function scheduleNextReview(
  stored: StoredFSRSCard | null | undefined,
  rating: OurRating
): { stored: StoredFSRSCard; nextReviewAt: number } {
  const card = storedCardToFSRS(stored)
  const now = new Date()
  const grade = RATING_MAP[rating]

  const result: RecordLogItem = scheduler.next(card, now, grade)
  const newCard = result.card

  return {
    stored: fsrsCardToStored(newCard),
    nextReviewAt: newCard.due.getTime()
  }
}
