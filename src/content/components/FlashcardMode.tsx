/**
 * 闪卡学习模式组件
 * 
 * 这个组件实现闪卡学习功能：
 * 1. 显示单词原文，点击翻转显示翻译
 * 2. 支持"认识"、"不认识"、"已掌握"三种状态
 * 3. 根据掌握情况调整复习频率
 * 4. 支持键盘快捷键（空格翻转、方向键选择状态）
 * 5. 显示学习进度
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { RotateCcw, CheckCircle2, CheckCheck, XCircle, BookOpen, Volume2, VolumeX, X, ArrowLeft, ArrowRight } from 'lucide-react'
import { WordbookEntry } from '../../services/wordbook'
import type { OurRating } from '../../utils/fsrsScheduler'
import { ttsManager, detectLanguage, segmentTextByQuotesAndParentheses, type SupportedLanguage } from '../../utils/tts'

interface FlashcardModeProps {
  // 单词列表
  words: WordbookEntry[]
  // 关闭学习模式
  onClose: () => void
  // 刷新单词列表
  onRefresh: () => void
}

function FlashcardMode({ words, onClose, onRefresh }: FlashcardModeProps) {
  // 当前显示的单词索引
  const [currentIndex, setCurrentIndex] = useState(0)
  
  // 是否翻转（显示翻译）
  const [isFlipped, setIsFlipped] = useState(false)
  
  // 正在播放语音的单词 ID
  const [playingWordId, setPlayingWordId] = useState<string | null>(null)
  // 正在播放的部位
  const [playingPart, setPlayingPart] = useState<'original' | 'translation' | 'grammar' | 'context' | null>(null)
  
  // 已学习的单词 ID 集合（用于统计）
  const [studiedIds, setStudiedIds] = useState<Set<string>>(new Set())
  // 是否包含已掌握单词（用于「再学一遍（含已掌握）」）
  const [includeMastered, setIncludeMastered] = useState(false)
  // 本轮错题队列：点「不认识」的单词在本轮结束后再练一遍
  const [wrongQueue, setWrongQueue] = useState<WordbookEntry[]>([])
  // 第二轮：仅显示错题再练
  const [round2Words, setRound2Words] = useState<WordbookEntry[] | null>(null)
  // 本轮完成弹层（再学一遍 / 返回生词本）
  const [showRoundComplete, setShowRoundComplete] = useState(false)
  
  // 过滤出需要学习的单词（优先显示需要复习的，然后是未学习的）
  const wordsToStudy = useMemo(() => {
    if (includeMastered && words.length > 0) {
      return [...words]
    }
    const now = Date.now()
    const toReview = words.filter(w => !w.nextReviewAt || w.nextReviewAt <= now)
    const learning = words.filter(w => w.masteryStatus === 'learning' && w.nextReviewAt && w.nextReviewAt > now)
    const newWords = words.filter(w => !w.masteryStatus || w.masteryStatus === 'new')
    return [...toReview, ...learning, ...newWords]
  }, [words, includeMastered])
  
  // 当前实际学习的列表：第二轮则为错题列表，否则为 wordsToStudy
  const activeList = (round2Words != null && round2Words.length > 0) ? round2Words : wordsToStudy
  const currentWord = activeList[currentIndex]
  
  // 学习进度：已评估数量 / 总数，以及百分比
  const progress = useMemo(() => {
    const total = activeList.length
    const studied = studiedIds.size
    return {
      count: studied,
      total,
      percent: total > 0 ? Math.round((studied / total) * 100) : 0
    }
  }, [activeList.length, studiedIds.size])

  
  /**
   * 翻转卡片
   */
  const flipCard = useCallback(() => {
    setIsFlipped(!isFlipped)
  }, [isFlipped])
  
  /**
   * 更新学习状态（FSRS 评分：again / good / easy）
   */
  const updateStudyStatus = useCallback(async (rating: OurRating) => {
    if (!currentWord) return

    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_STUDY_STATUS',
        id: currentWord.id,
        rating
      })
      
      setStudiedIds(prev => new Set(prev).add(currentWord.id))
      onRefresh()
      
      const isLast = currentIndex >= activeList.length - 1
      const inRound2 = round2Words != null && round2Words.length > 0
      
      if (!isLast) {
        setCurrentIndex(currentIndex + 1)
        setIsFlipped(false)
        return
      }
      
      // 最后一张：若当前是第一轮且有错题，进入错题再练；否则显示完成弹层
      const queueForRound2 =
        rating === 'again' && currentWord ? [...wrongQueue, currentWord] : [...wrongQueue]
      if (!inRound2 && queueForRound2.length > 0) {
        setRound2Words(queueForRound2)
        setWrongQueue([])
        setCurrentIndex(0)
        setStudiedIds(new Set())
        setIsFlipped(false)
        return
      }
      
      setShowRoundComplete(true)
    } catch (error) {
      console.error('更新学习状态失败：', error)
      alert('更新学习状态失败，请稍后重试')
    }
  }, [currentWord, currentIndex, activeList.length, round2Words, wrongQueue, onRefresh])

  /** 处理「不认识」：FSRS Again，短期复习 */
  const handleAgain = useCallback(() => {
    if (currentWord) setWrongQueue(prev => [...prev, currentWord])
    updateStudyStatus('again')
  }, [currentWord, updateStudyStatus])

  /** 处理「认识」：FSRS Good，正常间隔 */
  const handleGood = useCallback(() => {
    updateStudyStatus('good')
  }, [updateStudyStatus])

  /** 处理「已掌握」：FSRS Easy，较长间隔 */
  const handleEasy = useCallback(() => {
    updateStudyStatus('easy')
  }, [updateStudyStatus])
  
  /**
   * 播放发音
   */
  // 与翻译窗口一致：优先用保存时的源语言（记忆机制），否则再检测；语法/语境按「」分段
  const sourceLang = useCallback((w: WordbookEntry): SupportedLanguage =>
    (w.sourceLanguage ?? detectLanguage(w.originalText)) as SupportedLanguage, [])
    
  const targetLang = useCallback((w: WordbookEntry): SupportedLanguage =>
    (w.targetLanguage as SupportedLanguage) ?? (w.translation ? detectLanguage(w.translation) : detectLanguage(w.originalText)), [])

  const handlePronounceOriginal = useCallback(() => {
    if (!currentWord) return
    if (playingWordId === currentWord.id && playingPart === 'original') {
      ttsManager.stop()
      setPlayingWordId(null)
      setPlayingPart(null)
      return
    }
    ttsManager.stop()
    setPlayingWordId(currentWord.id)
    setPlayingPart('original')
    ttsManager.speak(
      currentWord.originalText,
      sourceLang(currentWord),
      () => { setPlayingWordId(null); setPlayingPart(null) },
      (err) => {
        console.error('原文语音播放失败：', err)
        setPlayingWordId(null)
        setPlayingPart(null)
      }
    )
  }, [currentWord, playingWordId, playingPart, sourceLang])

  const handlePronounceTranslation = useCallback(() => {
    if (!currentWord) return
    if (playingWordId === currentWord.id && playingPart === 'translation') {
      ttsManager.stop()
      setPlayingWordId(null)
      setPlayingPart(null)
      return
    }
    ttsManager.stop()
    setPlayingWordId(currentWord.id)
    setPlayingPart('translation')
    ttsManager.speak(
      currentWord.translation,
      targetLang(currentWord),
      () => { setPlayingWordId(null); setPlayingPart(null) },
      (err) => {
        console.error('翻译语音播放失败：', err)
        setPlayingWordId(null)
        setPlayingPart(null)
      }
    )
  }, [currentWord, playingWordId, playingPart, targetLang])

  const handlePronounceGrammar = useCallback(() => {
    if (!currentWord || !currentWord.grammar) return
    if (playingWordId === currentWord.id && playingPart === 'grammar') {
      ttsManager.stop()
      setPlayingWordId(null)
      setPlayingPart(null)
      return
    }
    ttsManager.stop()
    setPlayingWordId(currentWord.id)
    setPlayingPart('grammar')
    const segments = segmentTextByQuotesAndParentheses(currentWord.grammar, sourceLang(currentWord), targetLang(currentWord))
    ttsManager.speakSegments(
      segments,
      () => { setPlayingWordId(null); setPlayingPart(null) },
      (err) => {
        console.error('语法语音播放失败：', err)
        setPlayingWordId(null)
        setPlayingPart(null)
      }
    )
  }, [currentWord, playingWordId, playingPart, sourceLang, targetLang])

  const handlePronounceContext = useCallback(() => {
    if (!currentWord || !currentWord.context) return
    if (playingWordId === currentWord.id && playingPart === 'context') {
      ttsManager.stop()
      setPlayingWordId(null)
      setPlayingPart(null)
      return
    }
    ttsManager.stop()
    setPlayingWordId(currentWord.id)
    setPlayingPart('context')
    const segments = segmentTextByQuotesAndParentheses(currentWord.context, sourceLang(currentWord), targetLang(currentWord))
    ttsManager.speakSegments(
      segments,
      () => { setPlayingWordId(null); setPlayingPart(null) },
      (err) => {
        console.error('语境语音播放失败：', err)
        setPlayingWordId(null)
        setPlayingPart(null)
      }
    )
  }, [currentWord, playingWordId, playingPart, sourceLang, targetLang])
  
  /**
   * 上一个单词
   */
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setIsFlipped(false)
    }
  }, [currentIndex])
  
  /**
   * 下一个单词
   */
  const handleNext = useCallback(() => {
    if (currentIndex < activeList.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setIsFlipped(false)
    }
  }, [currentIndex, activeList.length])
  
  /**
   * 键盘快捷键处理（在 input/textarea 中不触发，避免输入冲突）
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInputFocused =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable

      if (e.code === 'Space' && !isInputFocused) {
        e.preventDefault()
        flipCard()
        return
      }
      
      // 左箭头：上一个
      if (e.key === 'ArrowLeft' && !e.shiftKey) {
        e.preventDefault()
        handlePrevious()
        return
      }
      
      // 右箭头：下一个
      if (e.key === 'ArrowRight' && !e.shiftKey) {
        e.preventDefault()
        handleNext()
        return
      }
      
      // 数字键 1：不认识
      if (e.key === '1') {
        e.preventDefault()
        handleAgain()
        return
      }

      // 数字键 2：认识
      if (e.key === '2') {
        e.preventDefault()
        handleGood()
        return
      }

      // 数字键 3：已掌握
      if (e.key === '3') {
        e.preventDefault()
        handleEasy()
        return
      }
      
      // Esc：关闭
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [flipCard, handlePrevious, handleNext, handleAgain, handleGood, handleEasy, onClose])
  
  // 组件卸载或关闭时，停止语音播放
  useEffect(() => {
    return () => {
      ttsManager.stop()
    }
  }, [])
  
  // 本轮完成弹层：再学一遍 / 再学一遍（含已掌握）/ 返回生词本
  if (showRoundComplete) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-[1000003]"
        style={{
          background: 'rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          animation: 'fadeIn 0.25s ease'
        }}
      >
        <div className="w-full max-w-md mx-4 p-8 text-center rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(0, 0, 0, 0.12)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
          }}
        >
          <div className="w-14 h-14 mx-auto mb-5 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.06)' }}>
            <CheckCircle2 className="w-7 h-7" style={{ color: 'rgba(0, 0, 0, 0.6)' }} strokeWidth={2} />
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'rgba(0, 0, 0, 0.85)' }}>
            本轮完成
          </h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(0, 0, 0, 0.55)' }}>
            可以再学一遍巩固，或返回生词本
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                setShowRoundComplete(false)
                setRound2Words(null)
                setCurrentIndex(0)
                setStudiedIds(new Set())
                setIsFlipped(false)
              }}
              className="w-full px-5 py-2.5 text-sm font-medium rounded-xl transition-colors"
              style={{
                background: 'rgba(0, 0, 0, 0.08)',
                color: 'rgba(0, 0, 0, 0.75)',
                border: '1px solid rgba(0, 0, 0, 0.12)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.12)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.08)' }}
            >
              再学一遍
            </button>
            {words.length > 0 && (
              <button
                onClick={() => {
                  setIncludeMastered(true)
                  setShowRoundComplete(false)
                  setRound2Words(null)
                  setCurrentIndex(0)
                  setStudiedIds(new Set())
                  setWrongQueue([])
                  setIsFlipped(false)
                }}
                className="w-full px-5 py-2.5 text-sm font-medium rounded-xl transition-colors"
                style={{
                  background: 'rgba(0, 0, 0, 0.15)',
                  color: 'rgba(0, 0, 0, 0.9)',
                  border: '1px solid rgba(0, 0, 0, 0.2)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.15)' }}
              >
                再学一遍（含已掌握）
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full px-5 py-2.5 text-sm font-medium rounded-xl transition-colors"
              style={{
                background: 'rgba(255, 255, 255, 0.98)',
                color: 'rgba(0, 0, 0, 0.7)',
                border: '1px solid rgba(0, 0, 0, 0.15)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.98)' }}
            >
              返回生词本
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 如果没有单词，显示空状态（黑白配色）
  if (wordsToStudy.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-[1000003]"
        style={{
          background: 'rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          animation: 'fadeIn 0.25s ease'
        }}
      >
        <div className="w-full max-w-md mx-4 p-8 text-center rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(0, 0, 0, 0.12)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
          }}
        >
          <div className="w-14 h-14 mx-auto mb-5 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.06)' }}>
            <BookOpen className="w-7 h-7" style={{ color: 'rgba(0, 0, 0, 0.6)' }} strokeWidth={2} />
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'rgba(0, 0, 0, 0.85)' }}>
            没有需要学习的单词
          </h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(0, 0, 0, 0.55)' }}>
            所有单词都已掌握，或生词本为空
          </p>
          <div className="flex flex-col gap-2">
            {words.length > 0 && (
              <button
                onClick={() => {
                  setIncludeMastered(true)
                }}
                className="w-full px-5 py-2.5 text-sm font-medium rounded-xl transition-colors"
                style={{
                  background: 'rgba(0, 0, 0, 0.15)',
                  color: 'rgba(0, 0, 0, 0.9)',
                  border: '1px solid rgba(0, 0, 0, 0.2)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.15)' }}
              >
                再学一遍（含已掌握）
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full px-5 py-2.5 text-sm font-medium rounded-xl transition-colors"
              style={{
                background: 'rgba(0, 0, 0, 0.05)',
                color: 'rgba(0, 0, 0, 0.75)',
                border: '1px solid rgba(0, 0, 0, 0.12)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)' }}
            >
              返回生词本
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  if (!currentWord) {
    return null
  }
  
  return (
    <div className="fixed inset-0 flex items-center justify-center z-[1000003]"
      style={{
        background: 'rgba(0, 0, 0, 0.25)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.25s ease'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full mx-4 max-h-[92vh] flex flex-col overflow-hidden rounded-2xl"
        style={{
          padding: 0,
          maxWidth: 'min(960px, 95vw)',
          animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'auto',
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(0, 0, 0, 0.12)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 rounded-t-2xl" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.1)', background: 'rgba(250, 250, 250, 0.98)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.06)' }}>
              <BookOpen className="w-4 h-4" style={{ color: 'rgba(0, 0, 0, 0.6)' }} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'rgba(0, 0, 0, 0.85)' }}>
                {round2Words != null && round2Words.length > 0 ? '错题再练' : '闪卡学习'}
              </h2>
              <span className="text-xs" style={{ color: 'rgba(0, 0, 0, 0.5)' }}>
                {currentIndex + 1} / {activeList.length}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              ttsManager.stop()
              onClose()
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'rgba(0, 0, 0, 0.6)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            aria-label="关闭"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs" style={{ color: 'rgba(0, 0, 0, 0.55)' }}>学习进度</span>
            <span className="text-xs" style={{ color: 'rgba(0, 0, 0, 0.55)' }}>
              已评估 {progress.count}/{progress.total} ({progress.percent}%)
            </span>
          </div>
          <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0, 0, 0, 0.1)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress.percent}%`, background: 'rgba(0, 0, 0, 0.5)' }}
            />
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-5 min-h-0 overflow-hidden">
          <div
            className="w-full h-full max-h-[72vh] perspective-1000"
            style={{ perspective: '1000px', maxWidth: '900px' }}
          >
            <div
              className="relative w-full h-full min-h-[14rem] cursor-pointer transition-transform duration-500"
              style={{
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
              }}
              onClick={flipCard}
            >
              <div
                className="absolute inset-0 backface-hidden rounded-xl p-6 flex flex-col overflow-hidden"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(0deg)',
                  background: 'rgba(255, 255, 255, 0.98)',
                  border: '1px solid rgba(0, 0, 0, 0.1)'
                }}
              >
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden text-center w-full flex flex-col">
                  <h3
                    className="text-xl font-semibold mb-3 leading-relaxed"
                    style={{ color: 'rgba(0, 0, 0, 0.9)' }}
                  >
                    {currentWord.originalText}
                  </h3>
                  {currentWord.phonetic && (
                    <p className="text-base font-mono mb-3 shrink-0" style={{ color: 'rgba(0, 0, 0, 0.5)' }}>
                      [{currentWord.phonetic}]
                    </p>
                  )}
                  <div className="flex items-center justify-center gap-2 mt-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePronounceOriginal()
                      }}
                      className="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200"
                      style={{
                        color: playingWordId === currentWord.id && playingPart === 'original' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.5)',
                        background: playingWordId === currentWord.id && playingPart === 'original' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.05)'
                      }}
                      aria-label="播放发音"
                    >
                      {playingWordId === currentWord.id && playingPart === 'original' ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs mt-5 shrink-0" style={{ color: 'rgba(0, 0, 0, 0.5)' }}>
                    点击卡片翻转 · 空格键
                  </p>
                </div>
              </div>

              <div
                className="absolute inset-0 backface-hidden rounded-xl p-6 flex flex-col overflow-hidden"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: 'rgba(255, 255, 255, 0.98)',
                  border: '1px solid rgba(0, 0, 0, 0.1)'
                }}
              >
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden text-center w-full">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <h3
                      className="text-xl font-semibold leading-relaxed"
                      style={{ color: 'rgba(0, 0, 0, 0.85)' }}
                    >
                      {currentWord.translation}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePronounceTranslation()
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 shrink-0"
                      style={{
                        color: playingWordId === currentWord.id && playingPart === 'translation' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.5)',
                        background: playingWordId === currentWord.id && playingPart === 'translation' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.05)'
                      }}
                      aria-label="播放翻译"
                    >
                      {playingWordId === currentWord.id && playingPart === 'translation' ? (
                        <VolumeX className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  
                  {currentWord.grammar && (
                    <div className="mt-3 p-3 rounded-lg text-sm text-left" style={{ background: 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(0, 0, 0, 0.08)' }}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span style={{ color: 'rgba(0, 0, 0, 0.55)' }}>语法：</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePronounceGrammar()
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200 shrink-0"
                          style={{
                            color: playingWordId === currentWord.id && playingPart === 'grammar' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.5)',
                            background: playingWordId === currentWord.id && playingPart === 'grammar' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.05)'
                          }}
                          aria-label="播放语法解析"
                        >
                          {playingWordId === currentWord.id && playingPart === 'grammar' ? (
                            <VolumeX className="w-3.5 h-3.5" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <span className="block leading-relaxed" style={{ color: 'rgba(0, 0, 0, 0.85)' }}>{currentWord.grammar}</span>
                    </div>
                  )}
                  {currentWord.context && (
                    <div className="mt-2 p-3 rounded-lg text-sm text-left" style={{ background: 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(0, 0, 0, 0.08)' }}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span style={{ color: 'rgba(0, 0, 0, 0.55)' }}>语境：</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePronounceContext()
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200 shrink-0"
                          style={{
                            color: playingWordId === currentWord.id && playingPart === 'context' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.5)',
                            background: playingWordId === currentWord.id && playingPart === 'context' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.05)'
                          }}
                          aria-label="播放语境分析"
                        >
                          {playingWordId === currentWord.id && playingPart === 'context' ? (
                            <VolumeX className="w-3.5 h-3.5" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <span className="block leading-relaxed" style={{ color: 'rgba(0, 0, 0, 0.85)' }}>{currentWord.context}</span>
                    </div>
                  )}
                  <p className="text-xs mt-5 shrink-0" style={{ color: 'rgba(0, 0, 0, 0.5)' }}>
                    点击卡片返回原文
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 space-y-3" style={{ borderTop: '1px solid rgba(0, 0, 0, 0.1)' }}>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="w-9 h-9 flex items-center justify-center rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ background: 'rgba(0, 0, 0, 0.05)', color: 'rgba(0, 0, 0, 0.7)', border: '1px solid rgba(0, 0, 0, 0.12)' }}
              onMouseEnter={(e) => { if (currentIndex > 0) e.currentTarget.style.background = 'rgba(0, 0, 0, 0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)' }}
              aria-label="上一个"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              onClick={flipCard}
              className="px-4 py-2 text-sm font-medium flex items-center gap-2 rounded-xl transition-colors"
              style={{ background: 'rgba(0, 0, 0, 0.05)', color: 'rgba(0, 0, 0, 0.75)', border: '1px solid rgba(0, 0, 0, 0.12)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)' }}
            >
              <RotateCcw className="w-4 h-4" strokeWidth={2} />
              翻转
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === activeList.length - 1}
              className="w-9 h-9 flex items-center justify-center rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ background: 'rgba(0, 0, 0, 0.05)', color: 'rgba(0, 0, 0, 0.7)', border: '1px solid rgba(0, 0, 0, 0.12)' }}
              onMouseEnter={(e) => { if (currentIndex < activeList.length - 1) e.currentTarget.style.background = 'rgba(0, 0, 0, 0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)' }}
              aria-label="下一个"
            >
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handleAgain}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              style={{ background: 'rgba(0, 0, 0, 0.85)', color: '#fff', border: '1px solid rgba(0, 0, 0, 0.2)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.92)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.85)' }}
              title="完全不认识，需要短期复习"
            >
              <XCircle className="w-4 h-4" strokeWidth={2} />
              不认识
            </button>
            <button
              onClick={handleGood}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              style={{ background: 'rgba(0, 0, 0, 0.15)', color: 'rgba(0, 0, 0, 0.9)', border: '1px solid rgba(0, 0, 0, 0.2)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.22)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.15)' }}
              title="想起来了，正常复习间隔"
            >
              <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
              认识
            </button>
            <button
              onClick={handleEasy}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              style={{ background: 'rgba(255, 255, 255, 0.98)', color: 'rgba(0, 0, 0, 0.7)', border: '1px solid rgba(0, 0, 0, 0.15)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.98)' }}
              title="非常熟练，较长复习间隔"
            >
              <CheckCheck className="w-4 h-4" strokeWidth={2} />
              已掌握
            </button>
          </div>

          <p className="text-center text-xs" style={{ color: 'rgba(0, 0, 0, 0.5)' }}>
            <kbd className="px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(0, 0, 0, 0.06)' }}>Space</kbd> 翻转
            <span className="mx-1">·</span>
            <kbd className="px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(0, 0, 0, 0.06)' }}>←</kbd>/<kbd className="px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(0, 0, 0, 0.06)' }}>→</kbd> 切换
            <span className="mx-1">·</span>
            <kbd className="px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(0, 0, 0, 0.06)' }}>1</kbd>/<kbd className="px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(0, 0, 0, 0.06)' }}>2</kbd>/<kbd className="px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(0, 0, 0, 0.06)' }}>3</kbd> 状态
          </p>
        </div>
      </div>
    </div>
  )
}

export default FlashcardMode
