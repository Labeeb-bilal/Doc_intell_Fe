import { Fragment, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, FolderOpen, MessageSquare, Plus, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ChatMessage } from '@/components/ChatMessage'
import { CitationPanel } from '@/components/CitationPanel'
import { EmptyState } from '@/components/EmptyState'
import {
  totalDocuments,
  useChat,
  useConversations,
  useMessages,
  useStats,
  type ChatResponse,
  type Citation,
} from '@/api/hooks'
import { ApiError } from '@/api/client'
import { cn, formatDate, truncate } from '@/lib/utils'

const LOADING_STAGES = [
  'Searching documents…',
  'Reranking results…',
  'Generating answer…',
  'Checking for contradictions…',
]

interface LocalExchange {
  id: string
  query: string
  status: 'pending' | 'success' | 'error'
  response?: ChatResponse
  errorMessage?: string
}

export default function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const conversationId = searchParams.get('c') ?? undefined

  const [input, setInput] = useState('')
  const [localExchanges, setLocalExchanges] = useState<LocalExchange[]>([])
  const [openCitation, setOpenCitation] = useState<Citation | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('chat')
  const [loadingStage, setLoadingStage] = useState(0)
  // Deliberately separate from `conversationId`: only set on an explicit conversation
  // switch (sidebar click) or from the URL at mount. A conversation created by our own
  // send is rendered entirely from `localExchanges` — fetching its history the moment
  // `conversationId` first becomes defined would duplicate the turn we just showed.
  const [historyFetchId, setHistoryFetchId] = useState(() => searchParams.get('c') ?? undefined)

  const { data: stats } = useStats()
  const { data: conversations, isLoading: conversationsLoading } = useConversations()
  const { data: historicalMessages, isLoading: messagesLoading } = useMessages(historyFetchId)
  const chatMutation = useChat()

  const documentsLoaded = stats !== undefined
  const hasDocuments = totalDocuments(stats) > 0
  const activeConversation = conversations?.find((c) => c.id === conversationId)

  function scheduleLoadingStages() {
    setLoadingStage(0)
    const timers = [700, 1400, 2100].map((delay, i) => setTimeout(() => setLoadingStage(i + 1), delay))
    return () => timers.forEach(clearTimeout)
  }

  /**
   * Conversational context for the LLM's prompt only — never for retrieval,
   * and never a DB read; the last up-to-2 user turns already sitting in
   * this page's own state (historical + this-session local exchanges),
   * excluding the turn identified by `excludeId` (the one being sent right
   * now, whether a fresh send or a retry — never its own history).
   */
  function recentUserHistory(excludeId: string) {
    const historical = (historicalMessages ?? []).filter((m) => m.role === 'user').map((m) => m.content)
    const local = localExchanges.filter((ex) => ex.id !== excludeId).map((ex) => ex.query)
    return [...historical, ...local].slice(-2).map((content) => ({ role: 'user' as const, content }))
  }

  function runQuery(id: string, query: string) {
    const cancelStages = scheduleLoadingStages()
    const history = recentUserHistory(id)
    chatMutation.mutate(
      { query, conversation_id: conversationId, history, options: { detect_contradictions: true } },
      {
        onSuccess: (response) => {
          cancelStages()
          setLocalExchanges((prev) => prev.map((ex) => (ex.id === id ? { ...ex, status: 'success', response } : ex)))
          if (!conversationId) setSearchParams({ c: response.conversation_id })
        },
        onError: (err) => {
          cancelStages()
          const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
          setLocalExchanges((prev) =>
            prev.map((ex) => (ex.id === id ? { ...ex, status: 'error', errorMessage: message } : ex)),
          )
        },
      },
    )
  }

  function handleSend() {
    const query = input.trim()
    if (!query || query.length > 2000 || chatMutation.isPending) return
    setInput('')
    const id = crypto.randomUUID()
    setLocalExchanges((prev) => [...prev, { id, query, status: 'pending' }])
    runQuery(id, query)
  }

  function handleRetry(id: string, query: string) {
    if (chatMutation.isPending) return
    setLocalExchanges((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, status: 'pending', errorMessage: undefined } : ex)),
    )
    runQuery(id, query)
  }

  function handleSelectConversation(id: string) {
    setSearchParams({ c: id })
    setHistoryFetchId(id)
    setLocalExchanges([])
    setMobileView('chat')
  }

  function handleNewConversation() {
    setSearchParams({}, { replace: true })
    setHistoryFetchId(undefined)
    setLocalExchanges([])
    setInput('')
    setMobileView('chat')
  }

  const hasAnyMessages = (historicalMessages?.length ?? 0) > 0 || localExchanges.length > 0

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside
        className={cn(
          'flex w-full flex-col border-b md:w-72 md:shrink-0 md:border-b-0 md:border-r',
          mobileView === 'chat' && 'hidden md:flex',
        )}
      >
        <div className="border-b p-3">
          <Button variant="outline" className="w-full gap-2" onClick={handleNewConversation}>
            <Plus className="h-4 w-4" /> New conversation
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversationsLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !conversations || conversations.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              No conversations yet. Ask your first question.
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectConversation(c.id)}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 border-b px-3 py-2.5 text-left hover:bg-muted',
                  c.id === conversationId && 'bg-accent',
                )}
              >
                <span className="w-full truncate text-sm font-medium">
                  {c.title ? truncate(c.title, 35) : 'Untitled conversation'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(c.updated_at)}
                  {c.message_count > 0 ? ` · ${c.message_count} messages` : ''}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className={cn('flex min-w-0 flex-1 flex-col', mobileView === 'list' && 'hidden md:flex')}>
        <div className="flex items-center gap-2 border-b p-3 md:hidden">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileView('list')}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to conversations</span>
          </Button>
          <span className="truncate text-sm font-medium">
            {activeConversation?.title ? truncate(activeConversation.title, 40) : 'New conversation'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto max-w-3xl space-y-4">
            {historyFetchId && messagesLoading ? (
              <ChatSkeleton />
            ) : !hasAnyMessages ? (
              <EmptyState
                icon={MessageSquare}
                title={conversationId ? 'No messages yet' : 'No conversation selected'}
                description={
                  conversationId
                    ? 'Ask a question below to get started.'
                    : 'Start a new conversation or pick one from the list.'
                }
              />
            ) : (
              <>
                {historicalMessages?.map((m) => (
                  <ChatMessage
                    key={m.id}
                    role={m.role === 'user' ? 'user' : 'assistant'}
                    content={m.content}
                    citations={m.citations ?? []}
                    conversationId={conversationId}
                    messageId={m.id}
                    onCitationClick={setOpenCitation}
                  />
                ))}
                {localExchanges.map((ex) => (
                  <Fragment key={ex.id}>
                    <ChatMessage role="user" content={ex.query} />
                    {ex.status === 'success' && ex.response && (
                      <ChatMessage
                        role="assistant"
                        content={ex.response.answer}
                        citations={ex.response.citations}
                        contradictions={ex.response.contradictions}
                        contradictionsTotal={ex.response.contradictions_total}
                        conversationId={ex.response.conversation_id}
                        messageId={ex.response.message_id}
                        onCitationClick={setOpenCitation}
                      />
                    )}
                    {ex.status === 'error' && (
                      <ChatMessage
                        role="assistant"
                        content=""
                        errorMessage={ex.errorMessage}
                        onRetry={() => handleRetry(ex.id, ex.query)}
                      />
                    )}
                  </Fragment>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="border-t p-3">
          <div className="mx-auto max-w-3xl">
            {!documentsLoaded ? (
              <Skeleton className="h-16 w-full" />
            ) : !hasDocuments ? (
              <EmptyState
                icon={FolderOpen}
                title="No documents yet"
                description="Upload a document before you can start chatting."
                action={{ label: 'Go to upload', href: '/upload' }}
              />
            ) : chatMutation.isPending ? (
              <div className="flex h-[72px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
                {LOADING_STAGES.slice(0, loadingStage + 1).join(' → ')}
              </div>
            ) : (
              <Composer value={input} onChange={setInput} onSend={handleSend} />
            )}
          </div>
        </div>
      </div>

      <CitationPanel citation={openCitation} onOpenChange={(open) => !open && setOpenCitation(null)} />
    </div>
  )
}

function Composer({
  value,
  onChange,
  onSend,
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
}) {
  const nearLimit = value.length > 1800

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder="Ask a question about your documents…"
          aria-label="Chat message"
          rows={2}
          maxLength={2000}
          className="resize-none"
        />
        {nearLimit && (
          <p
            className={cn(
              'mt-1 text-right text-xs',
              value.length >= 2000 ? 'text-severity-critical' : 'text-muted-foreground',
            )}
          >
            {value.length}/2000
          </p>
        )}
      </div>
      <Button
        onClick={onSend}
        disabled={!value.trim()}
        size="icon"
        className="h-10 w-10 shrink-0"
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  )
}

function ChatSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Skeleton className="h-9 w-2/3 rounded-2xl" />
      </div>
      <Skeleton className="h-24 w-4/5 rounded-2xl" />
      <div className="flex justify-end">
        <Skeleton className="h-9 w-1/2 rounded-2xl" />
      </div>
      <Skeleton className="h-24 w-4/5 rounded-2xl" />
    </div>
  )
}
