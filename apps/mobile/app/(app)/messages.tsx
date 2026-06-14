import { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Send, MessageSquare, User } from 'lucide-react-native';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import { hasPermission } from '@/utils/permissions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Heading, Text, Caption } from '@/components/ui/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useHaptics } from '@/hooks/useHaptics';
import { trackScreenView } from '@/utils/analytics';
import Toast from 'react-native-toast-message';
import { PersonaGate } from '@/components/auth/PersonaGate';

function MessagesScreenContent() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { light } = useHaptics();
  const queryClient = useQueryClient();
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const currentUserId = user?.id;
  const canSendMessages = hasPermission(user, 'communications:send_message');

  useEffect(() => {
    trackScreenView('MessagesScreen');
  }, []);

  // Conversations list (grouped threads)
  const { data: conversations, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['messages_conversations'],
    queryFn: async () => {
      const res = await api.messages.conversations.get();
      if (res.error) throw res.error;
      return res.data?.data || [];
    },
  });

  // Individual conversation messages
  const { data: conversationData } = useQuery({
    queryKey: ['messages_conversation_detail', activeConversation?.participantId],
    queryFn: async () => {
      if (!activeConversation?.participantId) return { conversation: null, messages: [] };
      const res = await api.messages.conversations({ participantId: String(activeConversation.participantId) }).get();
      if (res.error) throw res.error;
      return res.data?.data || { conversation: null, messages: [] };
    },
    enabled: !!activeConversation?.participantId,
  });

  const conversationMessages = conversationData?.messages || [];

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!replyText.trim() || !activeConversation?.participantId) throw new Error('No message');
      const res = await api.messages.post({
        receiverId: activeConversation.participantId,
        content: replyText.trim(),
        messageType: 'TEXT',
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['messages_conversation_detail', activeConversation?.participantId] });
      queryClient.invalidateQueries({ queryKey: ['messages_conversations'] });
    },
    onError: (err: any) => {
      Toast.show({ type: 'error', text1: 'Send failed', text2: err.message });
    },
  });

  if (isError && !activeConversation) {
    return (
      <View className="flex-1 bg-notion-bg-secondary pt-12">
        <View className="px-4 pb-4 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => { light(); router.back(); }} className="w-10 h-10 items-center justify-center bg-notion-bg dark:bg-white/5 rounded-full border border-notion-border">
            <ChevronLeft size={24} color="#37352f" />
          </TouchableOpacity>
          <Heading className="text-notion-text">Messages</Heading>
          <View className="w-10 h-10" />
        </View>
        <ErrorState onRetry={refetch} />
      </View>
    );
  }

  // Mark conversation as read when opened
  useEffect(() => {
    if (activeConversation?.participantId && activeConversation?.unreadCount > 0) {
      api.messages.conversations({ participantId: String(activeConversation.participantId) }).read.patch()
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['messages_conversations'] });
          queryClient.invalidateQueries({ queryKey: ['messages_conversation_detail', activeConversation.participantId] });
        })
        .catch(() => { /* ignore read failures */ });
    }
  }, [activeConversation?.participantId]);

  if (activeConversation) {
    const isSent = (msg: any) => msg.senderId === currentUserId;

    return (
      <View className="flex-1 bg-notion-bg-secondary dark:bg-notion-bg">
        <View className="bg-notion-bg dark:bg-notion-bg-secondary border-b border-notion-border pt-14 pb-4 px-4 flex-row items-center">
          <TouchableOpacity onPress={() => { light(); setActiveConversation(null); }} className="w-10 h-10 items-center justify-center bg-notion-bg-secondary dark:bg-white/5 rounded-full">
            <ChevronLeft size={24} color="#37352f" />
          </TouchableOpacity>
          <View className="ml-3 flex-1">
            <Heading className="text-notion-text">{activeConversation.participantName || 'Conversation'}</Heading>
          </View>
          <View className="w-10 h-10" />
        </View>

        <ScrollView className="flex-1 p-4">
          {(conversationMessages || []).map((msg: any) => (
            <View key={msg.id} className={`mb-3 ${isSent(msg) ? 'items-end' : 'items-start'}`}>
              <View className={`max-w-[80%] rounded-xl p-3 ${isSent(msg) ? 'bg-notion-blue' : 'bg-notion-bg border border-notion-border'}`}>
                <Text className={isSent(msg) ? 'text-white' : 'text-notion-text'}>{msg.content}</Text>
                <Caption className={`text-[10px] mt-1 ${isSent(msg) ? 'text-white/70' : 'text-notion-text-secondary'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Caption>
              </View>
            </View>
          ))}
        </ScrollView>

        {canSendMessages ? (
          <View className="p-4 border-t border-notion-border flex-row items-center bg-notion-bg">
            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Type a message..."
              placeholderTextColor="#9ca3af"
              className="flex-1 bg-notion-bg-secondary rounded-xl px-4 py-3 text-notion-text"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              onPress={() => sendMessageMutation.mutate()}
              disabled={sendMessageMutation.isPending || !replyText.trim()}
              className="ml-3 w-10 h-10 bg-notion-blue rounded-full items-center justify-center"
            >
              <Send size={18} color="white" />
            </TouchableOpacity>
          </View>
        ) : (
          <View className="p-4 border-t border-notion-border bg-notion-bg-secondary">
            <Text className="text-center text-notion-text-secondary text-sm">You don't have permission to send messages.</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-notion-bg-secondary dark:bg-notion-bg">
      <View className="bg-notion-bg dark:bg-notion-bg-secondary border-b border-notion-border pt-14 pb-4 px-4 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => { light(); router.back(); }} className="w-10 h-10 items-center justify-center bg-notion-bg-secondary dark:bg-white/5 rounded-full">
          <ChevronLeft size={24} color="#37352f" />
        </TouchableOpacity>
        <Heading className="text-notion-text">Messages</Heading>
        <View className="w-10 h-10" />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1a365d" />
        </View>
      ) : (
        <ScrollView
          className="flex-1 p-4"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#37352f" />}
        >
          {(conversations || []).length === 0 ? (
            <EmptyState
              title="No Messages"
              description="Your inbox is empty."
              icon={<MessageSquare size={32} color="#9ca3af" />}
            />
          ) : (
            (conversations || []).map((conv: any) => (
              <TouchableOpacity
                key={conv.id}
                onPress={() => { light(); setActiveConversation(conv); }}
                activeOpacity={0.7}
              >
                <Card variant="elevated" className={`mb-3 border ${conv.unreadCount > 0 ? 'border-notion-blue bg-notion-blue/5' : 'border-notion-border'}`} padding="md">
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 bg-notion-bg-secondary rounded-full items-center justify-center mr-3">
                      <User size={18} color="#9ca3af" />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row justify-between items-center">
                        <Text className="font-bold text-notion-text">{conv.participantName || 'Staff'}</Text>
                        <Caption className="text-notion-text-secondary">{conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString() : '—'}</Caption>
                      </View>
                      <Text className="text-notion-text-secondary text-sm mt-1" numberOfLines={1}>{conv.lastMessage || 'No messages yet'}</Text>
                    </View>
                    {conv.unreadCount > 0 && (
                      <View className="ml-2 min-w-[20px] h-5 bg-notion-blue rounded-full items-center justify-center px-1">
                        <Text className="text-white text-xs font-bold">{conv.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

export default function MessagesScreen() {
  return (
    <PersonaGate tab="messages">
      <MessagesScreenContent />
    </PersonaGate>
  );
}
