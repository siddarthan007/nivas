import { useEffect, useState } from 'react';
import { View, ScrollView, Switch as RNSwitch, TouchableOpacity, Modal, TextInput, ActivityIndicator, useColorScheme } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useBiometric } from '@/hooks/useBiometric';
import { useHaptics } from '@/hooks/useHaptics';
import { useObserve } from 'expo-observe';
import { 
  User, Building, Shield, Fingerprint, Moon, Sun, 
  Bell, LogOut, ChevronRight, Monitor, MessageSquare, 
  Clock, Phone, FileText, Check, Edit, Calendar, MapPin, ArrowLeft
} from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Heading, Text, Caption } from '@/components/ui/Typography';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useMobilePersona } from '@/hooks/useMobilePersona';
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer';

export default function ProfileScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { hasTab } = useMobilePersona();
  const isProfileTab = hasTab('profile') && (pathname === '/profile' || pathname.endsWith('/profile'));
  const insets = useSafeAreaInsets();
  const { user, logout, restore: restoreAuth } = useAuthStore();
  const { settings, updateSettings } = useSettingsStore();
  const { isAvailable, checkAvailability, authenticate } = useBiometric();
  const { light, medium, success: successHaptic, error: errorHaptic } = useHaptics();
  const { isTablet } = useDeviceType();
  const queryClient = useQueryClient();

  // Edit Profile Form State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Fetch Full Profile Data (Dynamically)
  const { data: profile, isLoading: isProfileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ['user_profile'],
    queryFn: async () => {
      const res = await api.iam.profile.get();
      if (res.error) throw res.error;
      return res.data?.data;
    }
  });

  // Fetch Hotel Settings
  const { data: hotelData, isLoading: isHotelLoading } = useQuery({
    queryKey: ['hotel_settings_profile'],
    queryFn: async () => {
      const res = await api.settings.get();
      if (res.error) throw res.error;
      return res.data?.data;
    }
  });

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  // Sync edit form fields when profile data loads
  // We initialize these directly when opening the modal to avoid setting state in useEffect
  const handleOpenEditModal = () => {
    light();
    setEditName(profile?.fullName || '');
    setEditPhone(profile?.phone || '');
    setIsEditModalOpen(true);
  };

  const handleLogout = () => {
    medium();
    logout();
  };

  // Edit Profile Mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { fullName: string; phone: string }) => {
      const res = await api.iam.profile.put(data);
      if (res.error) throw res.error;
      return res.data?.data;
    },
    onSuccess: () => {
      successHaptic();
      Toast.show({ type: 'success', text1: 'Profile Updated', text2: 'Your profile changes have been saved.' });
      queryClient.invalidateQueries({ queryKey: ['user_profile'] });
      restoreAuth(); // Sync the global auth state immediately
      setIsEditModalOpen(false);
    },
    onError: (err: any) => {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Update Failed', text2: err.message || 'Could not update profile.' });
    }
  });

  const handleSaveProfile = () => {
    if (!editName.trim()) {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Name cannot be empty.' });
      return;
    }
    if (!editPhone.trim()) {
      errorHaptic();
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Phone number cannot be empty.' });
      return;
    }
    light();
    updateProfileMutation.mutate({ fullName: editName, phone: editPhone });
  };

  const toggleBiometric = async (value: boolean) => {
    light();
    if (value) {
      const ok = await authenticate('Verify identity to enable biometrics');
      if (!ok) return;
    }
    await updateSettings({ biometricEnabled: value });
  };

  const toggleTheme = async () => {
    light();
    const nextTheme = settings.theme === 'light' ? 'dark' : settings.theme === 'dark' ? 'system' : 'light';
    await updateSettings({ theme: nextTheme });
  };

  const getThemeIcon = () => {
    if (settings.theme === 'dark') return <Moon size={20} className="text-notion-blue" />;
    if (settings.theme === 'light') return <Sun size={20} className="text-notion-blue" />;
    return <Monitor size={20} className="text-notion-blue" />;
  };

  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const systemScheme = useColorScheme();
  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && systemScheme === 'dark');

  if (isProfileLoading || isHotelLoading) {
    return (
      <View className="flex-1 bg-notion-bg-secondary dark:bg-notion-bg justify-center items-center">
        <ActivityIndicator size="large" color="#2eaadc" />
        <Text className="mt-4 text-notion-text-secondary">Loading profile...</Text>
      </View>
    );
  }

  const userRole = profile?.role?.name || user?.role || 'Staff';
  const roleLevel = profile?.role?.level !== undefined ? profile.role.level : 'N/A';

  return (
    <View className="flex-1 bg-notion-bg-secondary dark:bg-notion-bg">
      {/* Dynamic Header (Safe-Area Aware) */}
      <View 
        style={{ paddingTop: insets.top + 10 }}
        className="flex-row items-center justify-between px-6 pb-4 border-b border-notion-border dark:border-white/5 bg-notion-bg dark:bg-notion-bg-secondary shadow-sm"
      >
        {isProfileTab ? (
          <View className="w-10 h-10" />
        ) : (
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => { light(); router.back(); }}
            className="w-10 h-10 bg-notion-bg-secondary dark:bg-notion-bg-tertiary border border-notion-border dark:border-transparent rounded-full items-center justify-center shadow-sm"
          >
            <ArrowLeft size={20} color={settings.theme === 'dark' ? '#fff' : '#37352f'} />
          </TouchableOpacity>
        )}
        
        <Text className="text-notion-text dark:text-white font-bold text-lg">My Profile</Text>
        
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={handleLogout}
          className="w-10 h-10 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/10 rounded-full items-center justify-center shadow-sm"
        >
          <LogOut size={16} className="text-notion-red" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16 }}
      >
        <ResponsiveContainer maxWidth={800}>
          <View className="px-6 flex-col gap-6">
            
            {/* Premium Profile Hero Card (No name/email redundancies elsewhere) */}
            <Card variant="elevated" className="bg-notion-bg dark:bg-notion-bg-secondary border-notion-border dark:border-white/5 items-center py-6 shadow-sm">
              <View className="relative mb-3">
                <View className="w-24 h-24 bg-notion-blue-bg rounded-full items-center justify-center border-4 border-notion-blue/20 dark:border-notion-blue/30 shadow-inner">
                  <Text className="text-notion-blue dark:text-white text-3xl font-extrabold tracking-wider">
                    {getInitials(profile?.fullName || user?.name || '')}
                  </Text>
                </View>
                <View className="absolute right-0 bottom-1 w-6 h-6 bg-green-500 rounded-full border-4 border-notion-bg dark:border-notion-bg-secondary items-center justify-center shadow-sm">
                  <View className="w-2.5 h-2.5 bg-white rounded-full" />
                </View>
              </View>

              <Text className="text-notion-text dark:text-white text-2xl font-extrabold tracking-tight text-center">
                {profile?.fullName || user?.name}
              </Text>
              
              <Text className="text-notion-text-secondary dark:text-white/60 text-sm mt-1 text-center font-medium">
                {profile?.email || user?.email || 'No email configured'}
              </Text>

              {/* Role and Level Badge */}
              <View className="flex-row items-center mt-3 bg-notion-blue-bg dark:bg-notion-blue/10 px-4 py-1.5 rounded-full border border-notion-blue/20">
                <Shield size={13} className="text-notion-blue mr-1.5" />
                <Text className="text-notion-blue dark:text-white text-[10px] font-bold uppercase tracking-widest">
                  Level {roleLevel} • {userRole}
                </Text>
              </View>

              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={handleOpenEditModal}
                className="mt-5 flex-row items-center bg-notion-bg-secondary dark:bg-notion-bg-tertiary px-4 py-2.5 rounded-xl border border-notion-border dark:border-transparent"
              >
                <Edit size={14} className="text-notion-text dark:text-white mr-2" />
                <Text className="text-notion-text dark:text-white font-bold text-xs uppercase tracking-widest">Edit Profile</Text>
              </TouchableOpacity>
            </Card>

            {/* Responsive grid for settings details */}
            <View className={`flex-col gap-6 ${isTablet ? 'flex-row flex-wrap justify-between items-start' : ''}`}>
              
              {/* Card 1: Account Info (Only non-redundant properties) */}
              <View style={isTablet ? { width: '48%' } : {}}>
                <Text className="text-xs uppercase tracking-widest text-notion-text-secondary ml-2 mb-2 font-semibold">
                  Contact Details
                </Text>
                <Card variant="elevated" padding="none" className="overflow-hidden bg-notion-bg dark:bg-notion-bg-secondary border border-notion-border dark:border-white/5">
                  <View className="flex-row items-center px-4 py-4 border-b border-notion-border dark:border-white/5">
                    <View className="w-8 h-8 rounded-full bg-notion-blue-bg items-center justify-center">
                      <Phone size={16} className="text-notion-blue" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Caption className="text-notion-text-secondary text-[11px] uppercase">Phone Number</Caption>
                      <Text className="text-notion-text dark:text-white font-medium text-base mt-0.5">
                        {profile?.phone || 'N/A'}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center px-4 py-4">
                    <View className="w-8 h-8 rounded-full bg-notion-blue-bg items-center justify-center">
                      <Calendar size={16} className="text-notion-blue" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Caption className="text-notion-text-secondary text-[11px] uppercase">Joined Date</Caption>
                      <Text className="text-notion-text dark:text-white font-medium text-base mt-0.5">
                        {formatDate(profile?.createdAt || '')}
                      </Text>
                    </View>
                  </View>
                </Card>
              </View>

              {/* Card 2: Hotel Identity Profile */}
              {hotelData && (
                <View style={isTablet ? { width: '48%' } : {}}>
                  <Text className="text-xs uppercase tracking-widest text-notion-text-secondary ml-2 mb-2 font-semibold">
                    Hotel Identity
                  </Text>
                  <Card variant="elevated" padding="none" className="overflow-hidden bg-notion-bg dark:bg-notion-bg-secondary border border-notion-border dark:border-white/5">
                    <View className="flex-row items-center px-4 py-4 border-b border-notion-border dark:border-white/5">
                      <View className="w-8 h-8 rounded-full bg-notion-green-bg items-center justify-center">
                        <Building size={16} className="text-notion-green" />
                      </View>
                      <View className="ml-3 flex-1">
                        <Caption className="text-notion-text-secondary text-[11px] uppercase">Hotel Name</Caption>
                        <Text className="text-notion-text dark:text-white font-medium text-base mt-0.5">
                          {hotelData.branding?.name || 'N/A'}
                        </Text>
                      </View>
                    </View>

                    {hotelData.contact?.address && (
                      <View className="flex-row items-center px-4 py-4 border-b border-notion-border dark:border-white/5">
                        <View className="w-8 h-8 rounded-full bg-notion-green-bg items-center justify-center">
                          <MapPin size={16} className="text-notion-green" />
                        </View>
                        <View className="ml-3 flex-1">
                          <Caption className="text-notion-text-secondary text-[11px] uppercase">Address</Caption>
                          <Text className="text-notion-text dark:text-white font-medium text-base mt-0.5">
                            {hotelData.contact.address}
                          </Text>
                        </View>
                      </View>
                    )}

                    <View className="flex-row items-center px-4 py-4 border-b border-notion-border dark:border-white/5">
                      <View className="w-8 h-8 rounded-full bg-notion-green-bg items-center justify-center">
                        <FileText size={16} className="text-notion-green" />
                      </View>
                      <View className="ml-3 flex-1">
                        <Caption className="text-notion-text-secondary text-[11px] uppercase">PAN / VAT Number</Caption>
                        <Text className="text-notion-text dark:text-white font-medium text-base mt-0.5">
                          {hotelData.tax?.panNumber || hotelData.tax?.vatNumber || 'Not Configured'}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-center px-4 py-4">
                      <View className="w-8 h-8 rounded-full bg-notion-green-bg items-center justify-center">
                        <Clock size={16} className="text-notion-green" />
                      </View>
                      <View className="ml-3 flex-1">
                        <Caption className="text-notion-text-secondary text-[11px] uppercase">Check-in / Check-out</Caption>
                        <Text className="text-notion-text dark:text-white font-medium text-base mt-0.5">
                          {hotelData.regional?.checkInTime} / {hotelData.regional?.checkOutTime}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </View>
              )}

              {/* Card 3: App preferences */}
              <View style={isTablet ? { width: '48%' } : {}}>
                <Text className="text-xs uppercase tracking-widest text-notion-text-secondary ml-2 mb-2 font-semibold">
                  App Preferences
                </Text>
                <Card variant="elevated" padding="none" className="overflow-hidden bg-notion-bg dark:bg-notion-bg-secondary border border-notion-border dark:border-white/5">
                  <TouchableOpacity 
                    activeOpacity={0.7} 
                    onPress={toggleTheme}
                    className="flex-row items-center px-4 py-4 border-b border-notion-border dark:border-white/5"
                  >
                    <View className="w-10 h-10 rounded-xl bg-notion-blue-bg items-center justify-center">
                      {getThemeIcon()}
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-notion-text dark:text-white text-base font-semibold">Theme Mode</Text>
                      <Text className="text-notion-text-secondary text-xs mt-0.5">Adjust light, dark, or system scheme</Text>
                    </View>
                    <View className="flex-row items-center">
                      <Text className="text-notion-text dark:text-white mr-2 capitalize font-semibold">{settings.theme}</Text>
                      <ChevronRight size={16} className="text-notion-text-secondary" />
                    </View>
                  </TouchableOpacity>
                  
                  <View className="flex-row items-center px-4 py-3 border-b border-notion-border dark:border-white/5">
                    <View className="w-10 h-10 rounded-xl bg-notion-purple-bg items-center justify-center">
                      <Bell size={18} className="text-notion-purple" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-notion-text dark:text-white text-base font-semibold">Push Notifications</Text>
                      <Text className="text-notion-text-secondary text-xs mt-0.5">Alerts for orders, KOT, and clean status</Text>
                    </View>
                    <RNSwitch 
                      value={settings.pushNotifications} 
                      onValueChange={(v) => { light(); updateSettings({ pushNotifications: v })}}
                      trackColor={{ false: isDark ? '#2b2b2b' : '#e9e9e7', true: '#2eaadc' }}
                      thumbColor={isDark ? '#787774' : '#ffffff'}
                    />
                  </View>

                  {isAvailable && (
                    <View className="flex-row items-center px-4 py-3">
                      <View className="w-10 h-10 rounded-xl bg-notion-green-bg items-center justify-center">
                        <Fingerprint size={18} className="text-notion-green" />
                      </View>
                      <View className="flex-1 ml-3">
                        <Text className="text-notion-text dark:text-white text-base font-semibold">Biometric Unlock</Text>
                        <Text className="text-notion-text-secondary text-xs mt-0.5">Secure Face ID / Touch ID login</Text>
                      </View>
                      <RNSwitch 
                        value={settings.biometricEnabled} 
                        onValueChange={toggleBiometric}
                        trackColor={{ false: isDark ? '#2b2b2b' : '#e9e9e7', true: '#2eaadc' }}
                        thumbColor={isDark ? '#787774' : '#ffffff'}
                      />
                    </View>
                  )}
                </Card>
              </View>

              {/* Card 4: Communications */}
              <View style={isTablet ? { width: '48%' } : {}}>
                <Text className="text-xs uppercase tracking-widest text-notion-text-secondary ml-2 mb-2 font-semibold">
                  Communication
                </Text>
                <Card variant="elevated" padding="none" className="overflow-hidden bg-notion-bg dark:bg-notion-bg-secondary border border-notion-border dark:border-white/5">
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { light(); router.push('/notifications' as any); }}
                    className="flex-row items-center px-4 py-4 border-b border-notion-border dark:border-white/5"
                  >
                    <View className="w-10 h-10 rounded-xl bg-notion-orange-bg items-center justify-center">
                      <Bell size={18} className="text-notion-orange" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-notion-text dark:text-white text-base font-semibold">System Broadcasts</Text>
                      <Text className="text-notion-text-secondary text-xs mt-0.5">Important announcements from management</Text>
                    </View>
                    <ChevronRight size={16} className="text-notion-text-secondary" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { light(); router.push('/messages' as any); }}
                    className="flex-row items-center px-4 py-4"
                  >
                    <View className="w-10 h-10 rounded-xl bg-notion-blue-bg items-center justify-center">
                      <MessageSquare size={18} className="text-notion-blue" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-notion-text dark:text-white text-base font-semibold">Staff Chat Rooms</Text>
                      <Text className="text-notion-text-secondary text-xs mt-0.5">Real-time chat with online staff</Text>
                    </View>
                    <ChevronRight size={16} className="text-notion-text-secondary" />
                  </TouchableOpacity>
                </Card>
              </View>

            </View>

            {/* Version Footer */}
            <Text className="text-center text-notion-text-secondary text-[11px] mt-6 tracking-widest uppercase">
              Nivas OS Mobile  •  v1.0.0
            </Text>

          </View>
        </ResponsiveContainer>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isEditModalOpen}
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-notion-bg dark:bg-notion-bg-secondary rounded-t-[32px] px-6 pt-6 pb-12 border-t border-notion-border dark:border-transparent">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-6">
              <Heading className="text-xl text-notion-text dark:text-white">Edit Profile</Heading>
              <TouchableOpacity 
                onPress={() => { light(); setIsEditModalOpen(false); }}
                className="px-4 py-2 bg-notion-bg-secondary dark:bg-notion-bg-tertiary rounded-xl border border-notion-border dark:border-transparent"
              >
                <Text className="text-notion-text dark:text-white font-semibold text-xs uppercase tracking-wider">Cancel</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Form Fields */}
            <View className="flex-col gap-4">
              <View>
                <Text className="text-xs font-semibold text-notion-text-secondary mb-1.5 uppercase tracking-widest">
                  Full Name
                </Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter full name"
                  placeholderTextColor="#9ca3af"
                  className="bg-notion-bg-secondary dark:bg-notion-bg-tertiary border border-notion-border dark:border-white/5 rounded-xl px-4 py-3.5 text-notion-text dark:text-white text-base"
                />
              </View>

              <View className="mb-6">
                <Text className="text-xs font-semibold text-notion-text-secondary mb-1.5 uppercase tracking-widest">
                  Phone Number
                </Text>
                <TextInput
                  value={editPhone}
                  onChangeText={setEditPhone}
                  keyboardType="phone-pad"
                  placeholder="Enter phone number"
                  placeholderTextColor="#9ca3af"
                  className="bg-notion-bg-secondary dark:bg-notion-bg-tertiary border border-notion-border dark:border-white/5 rounded-xl px-4 py-3.5 text-notion-text dark:text-white text-base"
                />
              </View>

              {/* Submit Action */}
              <TouchableOpacity
                onPress={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
                className="bg-notion-blue rounded-xl py-4 items-center justify-center flex-row shadow-sm"
              >
                {updateProfileMutation.isPending ? (
                  <ActivityIndicator size="small" color="#ffffff" className="mr-2" />
                ) : (
                  <Check size={18} color="#ffffff" className="mr-2" />
                )}
                <Text className="text-white font-bold text-base">
                  {updateProfileMutation.isPending ? 'Saving changes...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
