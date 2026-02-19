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
import { RotateCcw, CheckCircle2, XCircle, BookOpen, Volume2, VolumeX, X, ArrowLeft, ArrowRight } from 'lucide-react'
import { WordbookEntry, MasteryStatus } from '../../services/wordbook'
import { ttsManager, detectLanguage, type SupportedLanguage } from '../../utils/tts'

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
  
  // 学习进度（基于当前轮）
  const progress = useMemo(() => {
    const total = activeList.length
    const studied = studiedIds.size
    return total > 0 ? Math.round((studied / total) * 100) : 0
  }, [activeList.length, studiedIds.size])
  
  /**
   * 翻转卡片
   */
  const flipCard = useCallback(() => {
    setIsFlipped(!isFlipped)
  }, [isFlipped])
  
  /**
   * 更新学习状态（并处理本轮结束：错题再练 / 完成弹层）
   */
  const updateStudyStatus = useCallback(async (
    status: MasteryStatus,
    isCorrect: boolean
  ) => {
    if (!currentWord) return
    
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_STUDY_STATUS',
        id: currentWord.id,
        status,
        isCorrect
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
      // 若本张选「不认识」，需把当前词一并加入错题再练（setState 可能尚未生效）
      const queueForRound2 = status === 'learning' && !isCorrect && currentWord
        ? [...wrongQueue, currentWord]
        : [...wrongQueue]
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
  }, [currentWord, currentIndex, activeList.length, round2Words, wrongQueue, onRefresh, onClose])
  
  /**
   * 处理"认识"按钮
   */
  const handleKnow = useCallback(() => {
    updateStudyStatus('mastered', true)
  }, [updateStudyStatus])
  
  /**
   * 处理「不认识」：加入错题队列（本轮结束后再练），并更新复习时间（2 分钟后再出现）
   */
  const handleDontKnow = useCallback(() => {
    if (currentWord) {
      setWrongQueue(prev => [...prev, currentWord])
    }
    updateStudyStatus('learning', false)
  }, [currentWord, updateStudyStatus])
  
  /**
   * 处理"已掌握"按钮（跳过）
   */
  const handleMastered = useCallback(() => {
    updateStudyStatus('mastered', true)
  }, [updateStudyStatus])
  
  /**
   * 播放发音
   */
  const handlePronounce = useCallback(() => {
    if (!currentWord) return
    
    // 如果正在播放，停止
    if (playingWordId === currentWord.id) {
      ttsManager.stop()
      setPlayingWordId(null)
      return
    }
    
    // 停止其他正在播放的单词
    if (playingWordId) {
      ttsManager.stop()
    }
    
    // 检测语言
    const detectedLang = detectLanguage(currentWord.originalText)
    
    // 开始播放
    setPlayingWordId(currentWord.id)
    
    ttsManager.speak(
      currentWord.originalText,
      detectedLang,
      () => {
        setPlayingWordId(null)
      },
      (error) => {
        console.error('语音播放失败：', error)
        setPlayingWordId(null)
        alert(`语音播放失败：${error.message}`)
      }
    )
  }, [currentWord, playingWordId])
  
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
    if (currentIndex < wordsToStudy.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setIsFlipped(false)
    }
  }, [currentIndex, wordsToStudy.length])
  
  /**
   * 键盘快捷键处理
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 空格键：翻转卡片
      if (e.code === 'Space' && !e.target || (e.target as HTMLElement).tagName !== 'INPUT') {
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
        handleDontKnow()
        return
      }
      
      // 数字键 2：认识
      if (e.key === '2') {
        e.preventDefault()
        handleKnow()
        return
      }
      
      // 数字键 3：已掌握
      if (e.key === '3') {
        e.preventDefault()
        handleMastered()
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
  }, [flipCard, handlePrevious, handleNext, handleDontKnow, handleKnow, handleMastered, onClose])
  
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
            background: 'rgba(255, 242, 248, 0.98)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(220, 190, 200, 0.35)',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)'
          }}
        >
          <div className="w-14 h-14 mx-auto mb-5 rounded-xl flex items-center justify-center" style={{ background: 'rgba(240, 210, 220, 0.5)' }}>
            <CheckCircle2 className="w-7 h-7" style={{ color: 'rgba(120, 90, 100, 0.9)' }} strokeWidth={2} />
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
                background: 'rgba(240, 200, 215, 0.5)',
                color: 'rgba(0, 0, 0, 0.75)',
                border: '1px solid rgba(220, 180, 195, 0.5)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(235, 185, 205, 0.6)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(240, 200, 215, 0.5)' }}
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
                  background: 'rgba(220, 160, 180, 0.75)',
                  color: 'rgba(0, 0, 0, 0.9)',
                  border: '1px solid rgba(200, 140, 160, 0.5)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(210, 150, 170, 0.85)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(220, 160, 180, 0.75)' }}
              >
                再学一遍（含已掌握）
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full px-5 py-2.5 text-sm font-medium rounded-xl transition-colors"
              style={{
                background: 'rgba(255, 248, 252, 0.9)',
                color: 'rgba(0, 0, 0, 0.7)',
                border: '1px solid rgba(220, 190, 200, 0.5)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(250, 238, 245, 0.95)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 248, 252, 0.9)' }}
            >
              返回生词本
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 如果没有单词，显示空状态（与工具栏/翻译窗口一致的淡粉风格）
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
            background: 'rgba(255, 242, 248, 0.98)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(220, 190, 200, 0.35)',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)'
          }}
        >
          <div className="w-14 h-14 mx-auto mb-5 rounded-xl flex items-center justify-center" style={{ background: 'rgba(240, 210, 220, 0.5)' }}>
            <BookOpen className="w-7 h-7" style={{ color: 'rgba(120, 90, 100, 0.9)' }} strokeWidth={2} />
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
                  background: 'rgba(220, 160, 180, 0.75)',
                  color: 'rgba(0, 0, 0, 0.9)',
                  border: '1px solid rgba(200, 140, 160, 0.5)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(210, 150, 170, 0.85)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(220, 160, 180, 0.75)' }}
              >
                再学一遍（含已掌握）
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full px-5 py-2.5 text-sm font-medium rounded-xl transition-colors"
              style={{
                background: 'rgba(240, 200, 215, 0.5)',
                color: 'rgba(0, 0, 0, 0.75)',
                border: '1px solid rgba(220, 180, 195, 0.5)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(235, 185, 205, 0.6)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(240, 200, 215, 0.5)' }}
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
      <div className="w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden rounded-2xl"
        style={{
          padding: 0,
          animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'auto',
          background: 'rgba(255, 242, 248, 0.98)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(220, 190, 200, 0.35)',
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 rounded-t-2xl" style={{ borderBottom: '1px solid rgba(220, 190, 200, 0.3)', background: 'rgba(255, 238, 245, 0.95)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(240, 210, 220, 0.5)' }}>
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
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'rgba(0, 0, 0, 0.6)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(240, 210, 220, 0.5)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            aria-label="关闭"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs" style={{ color: 'rgba(0, 0, 0, 0.55)' }}>学习进度</span>
            <span className="text-xs" style={{ color: 'rgba(0, 0, 0, 0.55)' }}>{progress}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(220, 190, 200, 0.35)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: 'rgba(220, 160, 180, 0.85)' }}
            />
          </div>
        </div>
        
        {/* 闪卡区域 */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div 
            className="w-full max-w-lg perspective-1000"
            style={{ perspective: '1000px' }}
          >
            <div
              className="relative w-full h-64 cursor-pointer transition-transform duration-500"
              style={{
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
              }}
              onClick={flipCard}
            >
              {/* 正面（原文） */}
              <div
                className="absolute inset-0 backface-hidden rounded-xl p-8 flex flex-col items-center justify-center"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(0deg)',
                  background: 'rgba(255, 248, 252, 0.9)',
                  border: '1px solid rgba(220, 190, 200, 0.3)'
                }}
              >
                <div className="text-center w-full">
                  <h3 className="text-2xl font-semibold mb-4" style={{ color: 'rgba(0, 0, 0, 0.85)' }}>
                    {currentWord.originalText}
                  </h3>
                  {currentWord.phonetic && (
                    <p className="text-lg font-mono mb-4" style={{ color: 'rgba(0, 0, 0, 0.5)' }}>
                      [{currentWord.phonetic}]
                    </p>
                  )}
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePronounce()
                      }}
                      className="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200"
                      style={{
                        color: playingWordId === currentWord.id ? 'rgba(180, 100, 130, 0.95)' : 'rgba(0, 0, 0, 0.55)',
                        background: playingWordId === currentWord.id ? 'rgba(240, 200, 215, 0.6)' : 'rgba(240, 210, 220, 0.5)'
                      }}
                      aria-label="播放发音"
                    >
                      {playingWordId === currentWord.id ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-sm mt-6" style={{ color: 'rgba(0, 0, 0, 0.5)' }}>
                    点击卡片翻转查看翻译
                  </p>
                  <p className="text-xs mt-2" style={{ color: 'rgba(0, 0, 0, 0.45)' }}>
                    或按空格键
                  </p>
                </div>
              </div>

              {/* 背面（翻译） */}
              <div
                className="absolute inset-0 backface-hidden rounded-xl p-8 flex flex-col items-center justify-center"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: 'rgba(255, 248, 252, 0.9)',
                  border: '1px solid rgba(220, 190, 200, 0.3)'
                }}
              >
                <div className="text-center w-full">
                  <h3 className="text-2xl font-semibold mb-4" style={{ color: 'rgba(0, 0, 0, 0.85)' }}>
                    {currentWord.translation}
                  </h3>
                  {currentWord.grammar && (
                    <div className="mt-4 p-3 rounded-lg text-sm text-left" style={{ background: 'rgba(255, 250, 252, 0.8)', border: '1px solid rgba(220, 190, 200, 0.25)' }}>
                      <span style={{ color: 'rgba(0, 0, 0, 0.55)' }}>语法：</span>
                      <span className="ml-2" style={{ color: 'rgba(0, 0, 0, 0.85)' }}>{currentWord.grammar}</span>
                    </div>
                  )}
                  {currentWord.context && (
                    <div className="mt-3 p-3 rounded-lg text-sm text-left" style={{ background: 'rgba(255, 250, 252, 0.8)', border: '1px solid rgba(220, 190, 200, 0.25)' }}>
                      <span style={{ color: 'rgba(0, 0, 0, 0.55)' }}>语境：</span>
                      <span className="ml-2" style={{ color: 'rgba(0, 0, 0, 0.85)' }}>{currentWord.context}</span>
                    </div>
                  )}
                  <p className="text-sm mt-6" style={{ color: 'rgba(0, 0, 0, 0.5)' }}>
                    点击卡片返回原文
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4" style={{ borderTop: '1px solid rgba(220, 190, 200, 0.3)' }}>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="w-9 h-9 flex items-center justify-center rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ background: 'rgba(240, 210, 220, 0.5)', color: 'rgba(0, 0, 0, 0.7)', border: '1px solid rgba(220, 190, 200, 0.35)' }}
              onMouseEnter={(e) => { if (currentIndex > 0) e.currentTarget.style.background = 'rgba(235, 200, 215, 0.6)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(240, 210, 220, 0.5)' }}
              aria-label="上一个"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              onClick={flipCard}
              className="px-4 py-2 text-sm font-medium flex items-center gap-2 rounded-xl transition-colors"
              style={{ background: 'rgba(240, 210, 220, 0.5)', color: 'rgba(0, 0, 0, 0.75)', border: '1px solid rgba(220, 190, 200, 0.35)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(235, 200, 215, 0.6)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(240, 210, 220, 0.5)' }}
            >
              <RotateCcw className="w-4 h-4" strokeWidth={2} />
              翻转
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === activeList.length - 1}
              className="w-9 h-9 flex items-center justify-center rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ background: 'rgba(240, 210, 220, 0.5)', color: 'rgba(0, 0, 0, 0.7)', border: '1px solid rgba(220, 190, 200, 0.35)' }}
              onMouseEnter={(e) => { if (currentIndex < activeList.length - 1) e.currentTarget.style.background = 'rgba(235, 200, 215, 0.6)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(240, 210, 220, 0.5)' }}
              aria-label="下一个"
            >
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handleDontKnow}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              style={{ background: 'rgba(220, 100, 120, 0.85)', color: '#fff', border: '1px solid rgba(200, 80, 100, 0.4)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(200, 85, 105, 0.95)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(220, 100, 120, 0.85)' }}
            >
              <XCircle className="w-4 h-4" strokeWidth={2} />
              不认识 (1)
            </button>
            <button
              onClick={handleKnow}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              style={{ background: 'rgba(220, 160, 180, 0.75)', color: 'rgba(0, 0, 0, 0.9)', border: '1px solid rgba(200, 140, 160, 0.5)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(210, 150, 170, 0.85)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(220, 160, 180, 0.75)' }}
            >
              <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
              认识 (2)
            </button>
            <button
              onClick={handleMastered}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              style={{ background: 'rgba(255, 248, 252, 0.9)', color: 'rgba(0, 0, 0, 0.7)', border: '1px solid rgba(220, 190, 200, 0.5)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(250, 238, 245, 0.95)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 248, 252, 0.9)' }}
            >
              <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
              已掌握 (3)
            </button>
          </div>

          <p className="text-center text-xs" style={{ color: 'rgba(0, 0, 0, 0.5)' }}>
            <kbd className="px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(240, 210, 220, 0.5)' }}>Space</kbd> 翻转
            <span className="mx-1">·</span>
            <kbd className="px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(240, 210, 220, 0.5)' }}>←</kbd>/<kbd className="px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(240, 210, 220, 0.5)' }}>→</kbd> 切换
            <span className="mx-1">·</span>
            <kbd className="px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(240, 210, 220, 0.5)' }}>1</kbd>/<kbd className="px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(240, 210, 220, 0.5)' }}>2</kbd>/<kbd className="px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(240, 210, 220, 0.5)' }}>3</kbd> 状态
          </p>
        </div>
      </div>
    </div>
  )
}

export default FlashcardMode
