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

import React, { useState, useMemo, useEffect } from 'react'
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

  // 每次打开面板时刷新列表，确保从工具栏「加入生词本」后能看到刚加入的条目
  useEffect(() => {
    if (isOpen) {
      refresh()
    }
  }, [isOpen, refresh])

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
        background: 'rgba(0, 0, 0, 0.2)', // 豆包风格：更柔和的遮罩
        animation: 'fadeIn 0.25s ease',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        pointerEvents: 'auto'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="notion-panel w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col overflow-hidden"
        style={{
          padding: 0,
          borderRadius: '16px', // 豆包风格：更大的圆角
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(0, 0, 0, 0.06)',
          animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--notion-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: 'var(--notion-hover)' }}>
              <BookOpen className="w-4 h-4" style={{ color: 'var(--notion-text-secondary)' }} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--notion-text)' }}>
                生词本
              </h2>
              <span className="text-xs" style={{ color: 'var(--notion-text-tertiary)' }}>
                {filteredWords.length} 个单词
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded transition-colors"
            style={{ color: 'var(--notion-text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--notion-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            aria-label="关闭"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* 工具栏 */}
        <div className="px-5 py-3 space-y-3" style={{ borderBottom: '1px solid var(--notion-border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--notion-text-tertiary)' }} strokeWidth={2} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="搜索单词..."
                className="w-full pl-9 pr-3 py-2 rounded text-sm outline-none transition-colors"
                style={{
                  border: '1px solid var(--notion-border-strong)',
                  background: 'var(--notion-bg)',
                  color: 'var(--notion-text)'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--notion-accent)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--notion-border-strong)'
                }}
              />
            </div>
            {selectedIds.size > 0 && (
              <button
                onClick={handleBatchDelete}
                className="px-3 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                style={{
                  background: 'var(--notion-error)',
                  color: '#fff',
                  border: 'none'
                }}
              >
                <Trash2 className="w-4 h-4" strokeWidth={2} />
                删除选中 ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => handleExport('json')}
              className="notion-btn-secondary px-3 py-2 text-sm font-medium flex items-center gap-2"
            >
              <Download className="w-4 h-4" strokeWidth={2} />
              导出 JSON
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="notion-btn-secondary px-3 py-2 text-sm font-medium flex items-center gap-2"
            >
              <Download className="w-4 h-4" strokeWidth={2} />
              导出 CSV
            </button>
            <button
              onClick={() => setShowFlashcardMode(true)}
              className="notion-btn-primary px-3 py-2 text-sm font-medium flex items-center gap-2"
            >
              <Play className="w-4 h-4" strokeWidth={2} />
              学习模式
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--notion-border-strong) transparent' }}>
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-transparent border-t-current" style={{ color: 'var(--notion-accent)' }} />
              <span className="mt-3 text-xs" style={{ color: 'var(--notion-text-tertiary)' }}>加载中...</span>
            </div>
          )}

          {error && !isLoading && (
            <div className="notion-card p-4 border-l-4" style={{ borderLeftColor: 'var(--notion-error)' }}>
              <p className="text-sm" style={{ color: 'var(--notion-text-secondary)' }}>{error}</p>
            </div>
          )}

          {!isLoading && !error && filteredWords.length === 0 && (
            <div className="text-center py-14">
              <div className="w-14 h-14 mx-auto mb-4 rounded-md flex items-center justify-center" style={{ background: 'var(--notion-hover)' }}>
                <BookOpen className="w-7 h-7" style={{ color: 'var(--notion-text-tertiary)' }} strokeWidth={2} />
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--notion-text)' }}>
                {searchQuery ? '没有找到匹配的单词' : '生词本为空'}
              </p>
              <p className="text-xs" style={{ color: 'var(--notion-text-tertiary)' }}>
                {searchQuery ? '尝试其他关键词' : '选中网页文字并保存到生词本'}
              </p>
            </div>
          )}

          {!isLoading && !error && filteredWords.length > 0 && (
            <div className="space-y-2">
              {filteredWords.length > 0 && (
                <div className="flex items-center gap-2 pb-3 mb-3" style={{ borderBottom: '1px solid var(--notion-border)' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredWords.length && filteredWords.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded cursor-pointer"
                    style={{ accentColor: 'var(--notion-accent)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--notion-text-secondary)' }}>全选</span>
                </div>
              )}

              {filteredWords.map((word) => (
                <div
                  key={word.id}
                  className={`notion-card p-4 transition-colors ${selectedIds.has(word.id) ? 'ring-1' : ''}`}
                  style={{
                    borderColor: selectedIds.has(word.id) ? 'var(--notion-accent)' : undefined
                  }}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(word.id)}
                      onChange={() => toggleSelect(word.id)}
                      className="mt-0.5 w-4 h-4 rounded cursor-pointer"
                      style={{ accentColor: 'var(--notion-accent)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--notion-text)' }}>
                              {word.originalText}
                            </h3>
                            <button
                              onClick={() => handlePronounce(word)}
                              className="w-7 h-7 flex items-center justify-center rounded transition-colors flex-shrink-0"
                              style={{
                                color: playingWordId === word.id ? 'var(--notion-accent)' : 'var(--notion-text-secondary)',
                                background: playingWordId === word.id ? 'rgba(35, 131, 226, 0.1)' : 'var(--notion-hover)'
                              }}
                              aria-label={playingWordId === word.id ? '停止播放' : '播放发音'}
                              title={playingWordId === word.id ? '停止播放' : '播放发音'}
                            >
                              {playingWordId === word.id ? (
                                <VolumeX className="w-3.5 h-3.5" strokeWidth={2} />
                              ) : (
                                <Volume2 className="w-3.5 h-3.5" strokeWidth={2} />
                              )}
                            </button>
                          </div>
                          {word.phonetic && (
                            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--notion-text-tertiary)' }}>
                              [{word.phonetic}]
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(word.id)}
                          className="w-7 h-7 flex items-center justify-center rounded transition-colors flex-shrink-0"
                          style={{ color: 'var(--notion-error)', background: 'transparent' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--notion-hover)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                          aria-label="删除"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </div>
                      <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--notion-text)' }}>
                        {word.translation}
                      </p>
                      {word.grammar && (
                        <div className="notion-card mt-2 p-2 text-xs">
                          <span style={{ color: 'var(--notion-text-secondary)' }}>语法：</span>
                          <span className="ml-1" style={{ color: 'var(--notion-text)' }}>{word.grammar}</span>
                        </div>
                      )}
                      {word.context && (
                        <div className="notion-card mt-2 p-2 text-xs">
                          <span style={{ color: 'var(--notion-text-secondary)' }}>语境：</span>
                          <span className="ml-1" style={{ color: 'var(--notion-text)' }}>{word.context}</span>
                        </div>
                      )}
                      <div className="mt-2 text-xs" style={{ color: 'var(--notion-text-tertiary)' }}>
                        {new Date(word.createdAt).toLocaleString('zh-CN')} · 查看 {word.viewCount} 次
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
