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
  
  // 过滤出需要学习的单词（优先显示需要复习的，然后是未学习的）
  const wordsToStudy = useMemo(() => {
    const now = Date.now()
    
    // 分离需要复习的、学习中、新单词
    const toReview = words.filter(w => !w.nextReviewAt || w.nextReviewAt <= now)
    const learning = words.filter(w => w.masteryStatus === 'learning' && w.nextReviewAt && w.nextReviewAt > now)
    const newWords = words.filter(w => !w.masteryStatus || w.masteryStatus === 'new')
    
    // 合并：需要复习的 > 学习中的 > 新单词
    return [...toReview, ...learning, ...newWords]
  }, [words])
  
  // 当前单词
  const currentWord = wordsToStudy[currentIndex]
  
  // 学习进度
  const progress = useMemo(() => {
    const total = wordsToStudy.length
    const studied = studiedIds.size
    return total > 0 ? Math.round((studied / total) * 100) : 0
  }, [wordsToStudy.length, studiedIds.size])
  
  /**
   * 翻转卡片
   */
  const flipCard = useCallback(() => {
    setIsFlipped(!isFlipped)
  }, [isFlipped])
  
  /**
   * 更新学习状态
   */
  const updateStudyStatus = useCallback(async (
    status: MasteryStatus,
    isCorrect: boolean
  ) => {
    if (!currentWord) return
    
    try {
      // 发送消息更新学习状态
      await chrome.runtime.sendMessage({
        type: 'UPDATE_STUDY_STATUS',
        id: currentWord.id,
        status,
        isCorrect
      })
      
      // 标记为已学习
      setStudiedIds(prev => new Set(prev).add(currentWord.id))
      
      // 刷新单词列表
      onRefresh()
      
      // 移动到下一个单词
      if (currentIndex < wordsToStudy.length - 1) {
        setCurrentIndex(currentIndex + 1)
        setIsFlipped(false)
      } else {
        // 如果已经是最后一个，可以选择重新开始或关闭
        if (confirm('已完成所有单词！是否重新开始？')) {
          setCurrentIndex(0)
          setIsFlipped(false)
          setStudiedIds(new Set())
        } else {
          onClose()
        }
      }
    } catch (error) {
      console.error('更新学习状态失败：', error)
      alert('更新学习状态失败，请稍后重试')
    }
  }, [currentWord, currentIndex, wordsToStudy.length, onRefresh, onClose])
  
  /**
   * 处理"认识"按钮
   */
  const handleKnow = useCallback(() => {
    updateStudyStatus('mastered', true)
  }, [updateStudyStatus])
  
  /**
   * 处理"不认识"按钮
   */
  const handleDontKnow = useCallback(() => {
    updateStudyStatus('learning', false)
  }, [updateStudyStatus])
  
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
  
  // 如果没有单词，显示空状态
  if (wordsToStudy.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-[1000003]"
        style={{
          background: 'linear-gradient(135deg, rgba(45, 80, 22, 0.3) 0%, rgba(107, 159, 120, 0.2) 100%)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          animation: 'fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <div className="glass-effect rounded-3xl w-full max-w-md mx-4 p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" 
            style={{ background: 'rgba(107, 159, 120, 0.1)' }}>
            <BookOpen className="w-10 h-10" style={{ color: 'var(--forest-medium)' }} />
          </div>
          <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--forest-dark)' }}>
            没有需要学习的单词
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--apple-text-secondary)' }}>
            所有单词都已掌握，或者生词本为空
          </p>
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, var(--forest-accent) 0%, rgba(52, 199, 89, 0.8) 100%)',
              color: 'white',
              boxShadow: '0 4px 12px rgba(52, 199, 89, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(52, 199, 89, 0.4)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 199, 89, 0.3)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            返回生词本
          </button>
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
        background: 'linear-gradient(135deg, rgba(45, 80, 22, 0.3) 0%, rgba(107, 159, 120, 0.2) 100%)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        animation: 'fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="glass-effect rounded-3xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        style={{
          animation: 'slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid rgba(107, 159, 120, 0.2)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" 
              style={{ background: 'linear-gradient(135deg, rgba(52, 199, 89, 0.15) 0%, rgba(107, 159, 120, 0.1) 100%)' }}>
              <BookOpen className="w-5 h-5" style={{ color: 'var(--forest-medium)' }} />
            </div>
            <div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--forest-dark)' }}>
                闪卡学习
              </h2>
              <span className="text-sm font-medium" style={{ color: 'var(--apple-text-secondary)' }}>
                {currentIndex + 1} / {wordsToStudy.length}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            style={{ color: 'var(--apple-text-secondary)' }}
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* 进度条 */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--forest-medium)' }}>
              学习进度
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--forest-medium)' }}>
              {progress}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" 
            style={{ background: 'rgba(107, 159, 120, 0.1)' }}>
            <div 
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--forest-accent) 0%, rgba(52, 199, 89, 0.8) 100%)'
              }}
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
                className="absolute inset-0 backface-hidden forest-card rounded-3xl p-8 flex flex-col items-center justify-center"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(0deg)'
                }}
              >
                <div className="text-center w-full">
                  <h3 className="text-3xl font-bold mb-4" style={{ color: 'var(--apple-text)' }}>
                    {currentWord.originalText}
                  </h3>
                  {currentWord.phonetic && (
                    <p className="text-lg font-mono mb-4" style={{ color: 'var(--forest-medium)' }}>
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
                        color: playingWordId === currentWord.id ? 'var(--forest-accent)' : 'var(--forest-medium)',
                        background: playingWordId === currentWord.id 
                          ? 'rgba(52, 199, 89, 0.15)' 
                          : 'rgba(107, 159, 120, 0.1)'
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
                  <p className="text-sm mt-6" style={{ color: 'var(--apple-text-secondary)' }}>
                    点击卡片翻转查看翻译
                  </p>
                  <p className="text-xs mt-2" style={{ color: 'var(--apple-text-secondary)' }}>
                    或按空格键
                  </p>
                </div>
              </div>
              
              {/* 背面（翻译） */}
              <div 
                className="absolute inset-0 backface-hidden forest-card rounded-3xl p-8 flex flex-col items-center justify-center"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)'
                }}
              >
                <div className="text-center w-full">
                  <h3 className="text-3xl font-bold mb-4" style={{ color: 'var(--apple-text)' }}>
                    {currentWord.translation}
                  </h3>
                  {currentWord.grammar && (
                    <div className="forest-card mt-4 p-3 rounded-xl text-sm text-left" 
                      style={{ background: 'rgba(52, 199, 89, 0.08)' }}>
                      <span className="font-medium" style={{ color: 'var(--forest-medium)' }}>💡 语法：</span>
                      <span className="ml-2" style={{ color: 'var(--apple-text)' }}>{currentWord.grammar}</span>
                    </div>
                  )}
                  {currentWord.context && (
                    <div className="forest-card mt-3 p-3 rounded-xl text-sm text-left" 
                      style={{ background: 'rgba(74, 124, 89, 0.08)' }}>
                      <span className="font-medium" style={{ color: 'var(--forest-medium)' }}>🌿 语境：</span>
                      <span className="ml-2" style={{ color: 'var(--apple-text)' }}>{currentWord.context}</span>
                    </div>
                  )}
                  <p className="text-sm mt-6" style={{ color: 'var(--apple-text-secondary)' }}>
                    点击卡片返回原文
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="p-6 space-y-4" style={{ borderTop: '1px solid rgba(107, 159, 120, 0.2)' }}>
          {/* 导航按钮 */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                border: '1px solid rgba(107, 159, 120, 0.3)',
                color: 'var(--forest-medium)',
                background: currentIndex === 0 ? 'transparent' : 'rgba(107, 159, 120, 0.1)'
              }}
              aria-label="上一个"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <button
              onClick={flipCard}
              className="px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2"
              style={{
                border: '1px solid rgba(107, 159, 120, 0.3)',
                color: 'var(--forest-medium)',
                background: 'rgba(107, 159, 120, 0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(107, 159, 120, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(107, 159, 120, 0.1)'
              }}
            >
              <RotateCcw className="w-4 h-4" />
              翻转卡片
            </button>
            
            <button
              onClick={handleNext}
              disabled={currentIndex === wordsToStudy.length - 1}
              className="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                border: '1px solid rgba(107, 159, 120, 0.3)',
                color: 'var(--forest-medium)',
                background: currentIndex === wordsToStudy.length - 1 ? 'transparent' : 'rgba(107, 159, 120, 0.1)'
              }}
              aria-label="下一个"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
          
          {/* 状态按钮 */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleDontKnow}
              className="flex-1 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
                color: 'white',
                boxShadow: '0 4px 12px rgba(255, 107, 107, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 107, 107, 0.4)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 107, 107, 0.3)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <XCircle className="w-4 h-4" />
              不认识 (1)
            </button>
            
            <button
              onClick={handleKnow}
              className="flex-1 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, var(--forest-accent) 0%, rgba(52, 199, 89, 0.8) 100%)',
                color: 'white',
                boxShadow: '0 4px 12px rgba(52, 199, 89, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(52, 199, 89, 0.4)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 199, 89, 0.3)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <CheckCircle2 className="w-4 h-4" />
              认识 (2)
            </button>
            
            <button
              onClick={handleMastered}
              className="flex-1 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2"
              style={{
                border: '1px solid rgba(107, 159, 120, 0.3)',
                color: 'var(--forest-medium)',
                background: 'rgba(107, 159, 120, 0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(107, 159, 120, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(107, 159, 120, 0.1)'
              }}
            >
              <CheckCircle2 className="w-4 h-4" />
              已掌握 (3)
            </button>
          </div>
          
          {/* 快捷键提示 */}
          <div className="text-center">
            <p className="text-xs" style={{ color: 'var(--apple-text-secondary)' }}>
              <kbd className="px-2 py-1 rounded" style={{ background: 'rgba(107, 159, 120, 0.1)' }}>Space</kbd> 翻转 · 
              <kbd className="px-2 py-1 rounded" style={{ background: 'rgba(107, 159, 120, 0.1)' }}>←</kbd>/<kbd className="px-2 py-1 rounded" style={{ background: 'rgba(107, 159, 120, 0.1)' }}>→</kbd> 切换 · 
              <kbd className="px-2 py-1 rounded" style={{ background: 'rgba(107, 159, 120, 0.1)' }}>1</kbd>/<kbd className="px-2 py-1 rounded" style={{ background: 'rgba(107, 159, 120, 0.1)' }}>2</kbd>/<kbd className="px-2 py-1 rounded" style={{ background: 'rgba(107, 159, 120, 0.1)' }}>3</kbd> 选择状态
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FlashcardMode
