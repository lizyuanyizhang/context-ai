/**
 * 生词本管理面板组件
 * 
 * 这个组件负责：
 * 1. 显示生词本列表
 * 2. 搜索单词
 * 3. 删除单词
 * 4. 导出数据
 * 5. 查看单词详情
 */

import React, { useState, useMemo } from 'react'
import { Search, Trash2, Download, X, BookOpen, Volume2, VolumeX, Play } from 'lucide-react'
import { WordbookEntry } from '../../services/wordbook'
import { useWordbook } from '../hooks/useWordbook'
import { ttsManager, detectLanguage, type SupportedLanguage } from '../../utils/tts'
import FlashcardMode from './FlashcardMode'

interface WordbookPanelProps {
  // 是否显示面板
  isOpen: boolean
  // 关闭面板的回调
  onClose: () => void
}

function WordbookPanel({ isOpen, onClose }: WordbookPanelProps) {
  // 使用生词本 Hook
  const { words, isLoading, error, removeWord, searchWords, refresh, exportData } = useWordbook()
  
  // 搜索关键词
  const [searchQuery, setSearchQuery] = useState('')
  
  // 选中的单词（用于批量删除）
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  
  // 正在播放语音的单词 ID（用于显示播放状态）
  const [playingWordId, setPlayingWordId] = useState<string | null>(null)
  
  // 是否显示闪卡学习模式
  const [showFlashcardMode, setShowFlashcardMode] = useState(false)

  // 过滤后的单词列表（根据搜索关键词）
  const filteredWords = useMemo(() => {
    if (!searchQuery.trim()) {
      return words
    }
    
    const lowerQuery = searchQuery.toLowerCase()
    return words.filter(word => {
      return (
        word.originalText.toLowerCase().includes(lowerQuery) ||
        word.translation.toLowerCase().includes(lowerQuery) ||
        word.grammar?.toLowerCase().includes(lowerQuery) ||
        word.context?.toLowerCase().includes(lowerQuery)
      )
    })
  }, [words, searchQuery])

  // 处理搜索
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim()) {
      searchWords(query)
    } else {
      refresh()
    }
  }

  // 处理删除
  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个单词吗？')) {
      await removeWord(id)
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  // 处理批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      return
    }
    
    if (confirm(`确定要删除选中的 ${selectedIds.size} 个单词吗？`)) {
      for (const id of selectedIds) {
        await removeWord(id)
      }
      setSelectedIds(new Set())
    }
  }

  // 处理导出
  const handleExport = async (format: 'json' | 'csv') => {
    const data = await exportData(format)
    if (data) {
      // 创建下载链接
      const blob = new Blob([data], {
        type: format === 'json' ? 'application/json' : 'text/csv'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `生词本_${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  // 切换选中状态
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredWords.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredWords.map(word => word.id)))
    }
  }
  
  // 处理发音按钮点击：朗读单词原文
  const handlePronounce = (word: WordbookEntry) => {
    // 如果正在播放这个单词，停止播放
    if (playingWordId === word.id) {
      ttsManager.stop()
      setPlayingWordId(null)
      return
    }
    
    // 停止其他正在播放的单词
    if (playingWordId) {
      ttsManager.stop()
    }
    
    // 检测语言
    const detectedLang = detectLanguage(word.originalText)
    
    // 开始播放
    setPlayingWordId(word.id)
    
    ttsManager.speak(
      word.originalText,
      detectedLang,
      // 播放结束回调
      () => {
        setPlayingWordId(null)
      },
      // 播放错误回调
      (error) => {
        console.error('语音播放失败：', error)
        setPlayingWordId(null)
        alert(`语音播放失败：${error.message}\n请检查浏览器设置或系统语音配置`)
      }
    )
  }

  if (!isOpen) {
    return null
  }

  // 如果显示闪卡模式，渲染闪卡组件
  if (showFlashcardMode) {
    return (
      <FlashcardMode
        words={words}
        onClose={() => {
          setShowFlashcardMode(false)
          refresh() // 刷新单词列表以更新学习状态
        }}
        onRefresh={refresh}
      />
    )
  }

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-[1000002]"
      style={{
        // 苹果风格遮罩：使用更柔和的绿色调，营造森林感
        background: 'linear-gradient(135deg, rgba(45, 80, 22, 0.3) 0%, rgba(107, 159, 120, 0.2) 100%)',
        // 添加平滑的过渡动画，避免闪动
        animation: 'fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        // 使用更强的毛玻璃效果（苹果风格）
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        // 确保遮罩层不会阻止点击关闭
        pointerEvents: 'auto'
      }}
      onClick={(e) => {
        // 点击遮罩层时关闭面板
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className="glass-effect rounded-3xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col"
        style={{
          // 添加面板出现的动画（苹果风格：缩放+滑入）
          animation: 'slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          // 阻止点击事件冒泡到遮罩层
          pointerEvents: 'auto'
        }}
        onClick={(e) => {
          // 阻止点击面板内容时关闭
          e.stopPropagation()
        }}
      >
        {/* 头部（苹果风格） */}
        <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid rgba(107, 159, 120, 0.2)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(52, 199, 89, 0.15) 0%, rgba(107, 159, 120, 0.1) 100%)' }}>
              <BookOpen className="w-5 h-5" style={{ color: 'var(--forest-medium)' }} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold" style={{ color: 'var(--forest-dark)' }}>
                生词本
              </h2>
              <span className="text-sm font-medium" style={{ color: 'var(--apple-text-secondary)' }}>
                {filteredWords.length} 个单词
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

        {/* 工具栏（苹果风格） */}
        <div className="p-6 space-y-3" style={{ borderBottom: '1px solid rgba(107, 159, 120, 0.2)' }}>
          {/* 搜索框（苹果风格） */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: 'var(--apple-text-secondary)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="搜索单词..."
                className="w-full pl-11 pr-4 py-3 rounded-2xl transition-all duration-200"
                style={{
                  border: '1px solid rgba(107, 159, 120, 0.2)',
                  background: 'rgba(255, 255, 255, 0.6)',
                  color: 'var(--apple-text)',
                  fontSize: '14px'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--forest-accent)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(52, 199, 89, 0.1)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(107, 159, 120, 0.2)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>
            {selectedIds.size > 0 && (
              <button
                onClick={handleBatchDelete}
                className="px-4 py-2.5 text-white rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
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
                <Trash2 className="w-4 h-4" />
                删除选中 ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => handleExport('json')}
              className="px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2"
              style={{
                border: '1px solid rgba(107, 159, 120, 0.3)',
                color: 'var(--forest-medium)',
                background: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(107, 159, 120, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Download className="w-4 h-4" />
              导出 JSON
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2"
              style={{
                border: '1px solid rgba(107, 159, 120, 0.3)',
                color: 'var(--forest-medium)',
                background: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(107, 159, 120, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Download className="w-4 h-4" />
              导出 CSV
            </button>
            <button
              onClick={() => setShowFlashcardMode(true)}
              className="px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2"
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
              <Play className="w-4 h-4" />
              学习模式
            </button>
          </div>
        </div>

        {/* 内容区域（苹果风格滚动条） */}
        <div className="flex-1 overflow-y-auto p-6" style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(107, 159, 120, 0.3) transparent'
        }}>
          {/* 加载状态（苹果风格） */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-transparent border-t-current" style={{ color: 'var(--forest-accent)' }}></div>
                <div className="absolute inset-0 w-8 h-8 border-2 border-transparent border-t-current rounded-full animate-spin opacity-50" style={{ color: 'var(--forest-accent)' }}></div>
              </div>
              <span className="mt-4 text-sm font-medium" style={{ color: 'var(--apple-text-secondary)' }}>
                加载中...
              </span>
            </div>
          )}

          {/* 错误状态（苹果风格） */}
          {error && !isLoading && (
            <div className="forest-card p-5 rounded-2xl border-l-4" style={{ borderLeftColor: '#ff6b6b' }}>
              <p style={{ color: '#ff6b6b' }}>{error}</p>
            </div>
          )}

          {/* 空状态（苹果风格） */}
          {!isLoading && !error && filteredWords.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(107, 159, 120, 0.1)' }}>
                <BookOpen className="w-10 h-10" style={{ color: 'var(--forest-medium)' }} />
              </div>
              <p className="text-lg font-semibold mb-2" style={{ color: 'var(--apple-text)' }}>
                {searchQuery ? '没有找到匹配的单词' : '生词本为空'}
              </p>
              <p className="text-sm" style={{ color: 'var(--apple-text-secondary)' }}>
                {searchQuery ? '尝试使用其他关键词搜索' : '选中网页上的文字并保存到生词本'}
              </p>
            </div>
          )}

          {/* 单词列表 */}
          {!isLoading && !error && filteredWords.length > 0 && (
            <div className="space-y-3">
              {/* 全选按钮（苹果风格） */}
              {filteredWords.length > 0 && (
                <div className="flex items-center gap-3 pb-4 mb-4" style={{ borderBottom: '1px solid rgba(107, 159, 120, 0.2)' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredWords.length && filteredWords.length > 0}
                    onChange={toggleSelectAll}
                    className="w-5 h-5 rounded cursor-pointer"
                    style={{
                      accentColor: 'var(--forest-accent)'
                    }}
                  />
                  <span className="text-sm font-medium" style={{ color: 'var(--forest-medium)' }}>全选</span>
                </div>
              )}

              {/* 单词卡片（森林风格） */}
              {filteredWords.map((word) => (
                <div
                  key={word.id}
                  className={`forest-card p-5 rounded-2xl transition-all duration-200 ${
                    selectedIds.has(word.id) ? 'ring-2' : ''
                  }`}
                  style={{
                    borderColor: selectedIds.has(word.id) ? 'var(--forest-accent)' : 'rgba(107, 159, 120, 0.2)',
                    background: selectedIds.has(word.id) 
                      ? 'linear-gradient(135deg, rgba(52, 199, 89, 0.1) 0%, rgba(107, 159, 120, 0.05) 100%)'
                      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(245, 250, 245, 0.95) 100%)'
                  }}
                >
                  <div className="flex items-start gap-4">
                    {/* 复选框（苹果风格） */}
                    <input
                      type="checkbox"
                      checked={selectedIds.has(word.id)}
                      onChange={() => toggleSelect(word.id)}
                      className="mt-1 w-5 h-5 rounded cursor-pointer"
                      style={{
                        accentColor: 'var(--forest-accent)'
                      }}
                    />

                    {/* 内容 */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-semibold" style={{ color: 'var(--apple-text)' }}>
                              {word.originalText}
                            </h3>
                            {/* 发音按钮（苹果风格） */}
                            <button
                              onClick={() => handlePronounce(word)}
                              className="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 flex-shrink-0"
                              style={{
                                color: playingWordId === word.id ? 'var(--forest-accent)' : 'var(--forest-medium)',
                                background: playingWordId === word.id 
                                  ? 'rgba(52, 199, 89, 0.15)' 
                                  : 'rgba(107, 159, 120, 0.1)'
                              }}
                              onMouseEnter={(e) => {
                                if (playingWordId !== word.id) {
                                  e.currentTarget.style.background = 'rgba(107, 159, 120, 0.2)'
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (playingWordId !== word.id) {
                                  e.currentTarget.style.background = 'rgba(107, 159, 120, 0.1)'
                                }
                              }}
                              aria-label={playingWordId === word.id ? '停止播放' : '播放发音'}
                              title={playingWordId === word.id ? '停止播放' : '播放发音'}
                            >
                              {playingWordId === word.id ? (
                                <VolumeX className="w-4 h-4" />
                              ) : (
                                <Volume2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          {word.phonetic && (
                            <p className="text-sm font-mono mt-1" style={{ color: 'var(--forest-medium)' }}>
                              [{word.phonetic}]
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* 删除按钮 */}
                          <button
                            onClick={() => handleDelete(word.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 flex-shrink-0"
                            style={{
                              color: '#ff6b6b',
                              background: 'rgba(255, 107, 107, 0.1)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 107, 107, 0.2)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 107, 107, 0.1)'
                            }}
                            aria-label="删除"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <p className="text-base mb-3 leading-relaxed" style={{ color: 'var(--apple-text)' }}>
                        {word.translation}
                      </p>

                      {word.grammar && (
                        <div className="forest-card mt-3 p-3 rounded-xl text-sm" style={{ background: 'rgba(52, 199, 89, 0.08)' }}>
                          <span className="font-medium" style={{ color: 'var(--forest-medium)' }}>💡 语法：</span>
                          <span className="ml-2" style={{ color: 'var(--apple-text)' }}>{word.grammar}</span>
                        </div>
                      )}

                      {word.context && (
                        <div className="forest-card mt-3 p-3 rounded-xl text-sm" style={{ background: 'rgba(74, 124, 89, 0.08)' }}>
                          <span className="font-medium" style={{ color: 'var(--forest-medium)' }}>🌿 语境：</span>
                          <span className="ml-2" style={{ color: 'var(--apple-text)' }}>{word.context}</span>
                        </div>
                      )}

                      <div className="mt-3 text-xs" style={{ color: 'var(--apple-text-secondary)' }}>
                        添加于 {new Date(word.createdAt).toLocaleString('zh-CN')} · 
                        查看 {word.viewCount} 次
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default WordbookPanel
