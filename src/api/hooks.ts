import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query'
import { apiClient } from './client'
import type { components } from '@/types'

export type DocumentOut = components['schemas']['DocumentOut']
export type DocumentUploadItem = components['schemas']['DocumentUploadItem']
export type StatsResponse = components['schemas']['StatsResponse']
export type ChatRequest = components['schemas']['ChatRequest']
export type ChatResponse = components['schemas']['ChatResponse']
export type ConversationOut = components['schemas']['ConversationOut']
export type MessageOut = components['schemas']['MessageOut']
export type ContradictionGroupOut = components['schemas']['ContradictionGroupOut']
export type ContradictionRecordOut = components['schemas']['ContradictionRecordOut']
export type ContradictionListResponse = components['schemas']['ContradictionListResponse']
export type RetrievalTrace = components['schemas']['RetrievalTrace']
export type CandidateChunk = components['schemas']['CandidateChunk']
export type RerankResultEntry = components['schemas']['RerankResultEntry']
export type PairDecision = components['schemas']['PairDecision']
export type Citation = components['schemas']['Citation']
export type ContradictionStatus = 'open' | 'resolved' | 'false_positive'

/** Sum of documents_by_status — StatsResponse has no flat total_documents field. */
export function totalDocuments(stats: StatsResponse | undefined): number {
  if (!stats) return 0
  return Object.values(stats.documents_by_status).reduce((sum, n) => sum + n, 0)
}

const isInFlight = (status: string) => status === 'pending' || status === 'processing'

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export function useDocuments(status?: string) {
  return useQuery({
    queryKey: ['documents', status ?? 'all'] as QueryKey,
    queryFn: () =>
      apiClient.get<DocumentOut[]>(`/api/documents${status ? `?status=${status}` : ''}`),
    refetchInterval: (query) => {
      const docs = query.state.data as DocumentOut[] | undefined
      if (!docs) return false
      return docs.some((d) => isInFlight(d.status)) ? 2000 : false
    },
  })
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['documents', 'detail', id] as QueryKey,
    queryFn: () => apiClient.get<DocumentOut>(`/api/documents/${id}`),
    enabled: !!id,
  })
}

export function useUploadDocuments() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('files', file)
      const res = await apiClient.post<{ documents: DocumentUploadItem[] }>(
        '/api/documents',
        form,
        { raw: true },
      )
      return res.documents[0]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/api/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['contradictions'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useRetryDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.post<DocumentOut>(`/api/documents/${id}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

export function useStats() {
  return useQuery({
    queryKey: ['stats'] as QueryKey,
    queryFn: () => apiClient.get<StatsResponse>('/api/stats'),
  })
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export function useChat() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ChatRequest) => apiClient.post<ChatResponse>('/api/chat', body),
    onSuccess: () => {
      // Conversation list metadata (title/message_count) and contradiction counts
      // change on every turn. The active conversation's own message history is
      // intentionally NOT invalidated here — ChatPage renders the turn just sent
      // from the mutation response itself (which alone carries `contradictions`;
      // GET .../messages does not), so refetching would either race that render
      // or duplicate it once historical and local turns overlap.
      //
      // `exact: true` is load-bearing, not decoration: invalidateQueries matches
      // by KEY PREFIX by default, and useMessages()'s key is
      // ['conversations', conversationId, 'messages'] — sharing the
      // ['conversations'] prefix. Without `exact`, this call silently also
      // invalidates (and, for the conversation currently open, refetches) that
      // messages query — reintroducing the exact duplicate-render bug the
      // comment above claims doesn't happen, specifically for a follow-up sent
      // in a conversation that was opened via the sidebar (so its messages
      // query is already active) rather than a brand-new one.
      queryClient.invalidateQueries({ queryKey: ['conversations'], exact: true })
      queryClient.invalidateQueries({ queryKey: ['contradictions'] })
    },
  })
}

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'] as QueryKey,
    queryFn: () =>
      apiClient
        .get<{ conversations: ConversationOut[] }>('/api/conversations')
        .then((r) => r.conversations),
  })
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['conversations', conversationId, 'messages'] as QueryKey,
    queryFn: () =>
      apiClient
        .get<{ conversation_id: string; messages: MessageOut[] }>(
          `/api/conversations/${conversationId}/messages`,
        )
        .then((r) => r.messages),
    enabled: !!conversationId,
  })
}

export function useMessageTrace(
  conversationId: string | undefined,
  messageId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['conversations', conversationId, 'messages', messageId, 'trace'] as QueryKey,
    queryFn: () =>
      apiClient.get<RetrievalTrace>(
        `/api/conversations/${conversationId}/messages/${messageId}/trace`,
      ),
    enabled: enabled && !!conversationId && !!messageId,
    staleTime: Infinity, // a persisted trace never changes
  })
}

// ---------------------------------------------------------------------------
// Contradictions
// ---------------------------------------------------------------------------

export interface ContradictionFilters {
  status?: string
  severity?: string
  type?: string
  document_id?: string
  limit?: number
  offset?: number
}

function contradictionsQueryString(filters: ContradictionFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function useContradictions(filters: ContradictionFilters = {}) {
  return useQuery({
    queryKey: ['contradictions', filters] as QueryKey,
    queryFn: () =>
      apiClient.get<ContradictionListResponse>(
        `/api/contradictions${contradictionsQueryString(filters)}`,
      ),
  })
}

export function useContradiction(id: string | undefined) {
  return useQuery({
    queryKey: ['contradictions', 'detail', id] as QueryKey,
    queryFn: () => apiClient.get<ContradictionRecordOut>(`/api/contradictions/${id}`),
    enabled: !!id,
  })
}

interface UpdateContradictionVars {
  /** Every evidence-row id backing the group being updated (PATCH is per-row). */
  evidenceIds: string[]
  status: ContradictionStatus
  note?: string
}

/** Replaces `status` on every cached group whose evidence overlaps `evidenceIds`. */
function withUpdatedStatus(
  data: ContradictionListResponse | undefined,
  evidenceIds: string[],
  status: ContradictionStatus,
): ContradictionListResponse | undefined {
  if (!data) return data
  const idSet = new Set(evidenceIds)
  let changedRows = 0
  let previousStatus: string | undefined

  const contradictions = data.contradictions.map((group) => {
    const hit = group.evidence.some((e) => idSet.has(e.id))
    if (!hit) return group
    changedRows += group.evidence.length
    previousStatus = group.status
    return { ...group, status }
  })

  if (changedRows === 0) return data

  const counts = { ...data.counts }
  if (previousStatus) {
    counts[previousStatus] = Math.max(0, (counts[previousStatus] ?? 0) - changedRows)
  }
  counts[status] = (counts[status] ?? 0) + changedRows

  return { ...data, contradictions, counts }
}

export function useUpdateContradiction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ evidenceIds, status, note }: UpdateContradictionVars) => {
      const results: ContradictionRecordOut[] = []
      for (const [index, id] of evidenceIds.entries()) {
        if (index > 0) await new Promise((r) => setTimeout(r, 150))
        results.push(
          await apiClient.patch<ContradictionRecordOut>(`/api/contradictions/${id}`, {
            status,
            note: note || undefined,
          }),
        )
      }
      return results
    },
    onMutate: async ({ evidenceIds, status }) => {
      await queryClient.cancelQueries({ queryKey: ['contradictions'] })
      const previous = queryClient.getQueriesData<ContradictionListResponse>({
        queryKey: ['contradictions'],
      })

      for (const [key, data] of previous) {
        queryClient.setQueryData(key, withUpdatedStatus(data, evidenceIds, status))
      }

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (!context?.previous) return
      for (const [key, data] of context.previous) {
        queryClient.setQueryData(key, data)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['contradictions'] })
    },
  })
}
