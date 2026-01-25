import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  User,
  Camera,
  Bell,
  Shield,
  Eye,
  Lock,
  Globe,
  Moon,
  HelpCircle,
  FileText,
  LogOut,
  ChevronRight,
  Mail,
  Smartphone,
  Trash2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';

type SettingSection = 'main' | 'edit-profile' | 'privacy' | 'notifications';

export default function SettingsScreen() {
  const router = useRouter();
  const [currentSection, setCurrentSection] = useState<SettingSection>('main');
  
  const [profile, setProfile] = useState({
    displayName: 'Alex Johnson',
    username: 'alexj',
    email: 'alex@example.com',
    bio: 'House & techno enthusiast. Always chasing the perfect drop.',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop',
  });

  const [privacy, setPrivacy] = useState({
    profilePublic: true,
    showContributions: true,
    showFavorites: true,
    allowTagging: true,
  });

  const [notifications, setNotifications] = useState({
    pushEnabled: true,
    trackVerified: true,
    newFollowers: true,
    setUpdates: false,
    weeklyDigest: true,
    emailNotifications: false,
  });

  const handleSaveProfile = () => {
    Alert.alert('Success', 'Profile updated successfully!');
    setCurrentSection('main');
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: () => console.log('Logged out') },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => console.log('Account deleted') },
      ]
    );
  };

  const renderHeader = (title: string, showBack: boolean = false) => (
    <View style={styles.header}>
      {showBack ? (
        <Pressable style={styles.backButton} onPress={() => setCurrentSection('main')}>
          <ChevronLeft size={24} color={Colors.dark.text} />
        </Pressable>
      ) : (
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color={Colors.dark.text} />
        </Pressable>
      )}
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  const renderSettingRow = (
    icon: React.ReactNode,
    label: string,
    onPress: () => void,
    rightElement?: React.ReactNode,
    danger?: boolean
  ) => (
    <Pressable 
      style={styles.settingRow} 
      onPress={onPress}
      android_ripple={{ color: Colors.dark.border }}
    >
      <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>
        {icon}
      </View>
      <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>{label}</Text>
      {rightElement || <ChevronRight size={20} color={Colors.dark.textMuted} />}
    </Pressable>
  );

  const renderToggleRow = (
    icon: React.ReactNode,
    label: string,
    value: boolean,
    onToggle: (val: boolean) => void,
    description?: string
  ) => (
    <View style={styles.toggleRow}>
      <View style={styles.settingIcon}>{icon}</View>
      <View style={styles.toggleContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.toggleDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: Colors.dark.border, true: Colors.dark.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  const renderEditProfile = () => (
    <View style={styles.content}>
      {renderHeader('Edit Profile', true)}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
            <Pressable style={styles.cameraButton}>
              <Camera size={18} color="#FFFFFF" />
            </Pressable>
          </View>
          <Text style={styles.changePhotoText}>Change Profile Photo</Text>
        </View>

        <View style={styles.formSection}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Display Name</Text>
            <TextInput
              style={styles.textInput}
              value={profile.displayName}
              onChangeText={(text) => setProfile({ ...profile, displayName: text })}
              placeholderTextColor={Colors.dark.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <View style={styles.usernameInput}>
              <Text style={styles.usernamePrefix}>@</Text>
              <TextInput
                style={[styles.textInput, styles.usernameField]}
                value={profile.username}
                onChangeText={(text) => setProfile({ ...profile, username: text })}
                placeholderTextColor={Colors.dark.textMuted}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.textInput}
              value={profile.email}
              onChangeText={(text) => setProfile({ ...profile, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={Colors.dark.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              style={[styles.textInput, styles.bioInput]}
              value={profile.bio}
              onChangeText={(text) => setProfile({ ...profile, bio: text })}
              multiline
              numberOfLines={4}
              placeholderTextColor={Colors.dark.textMuted}
            />
          </View>
        </View>

        <Pressable style={styles.saveButton} onPress={handleSaveProfile}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </Pressable>
      </ScrollView>
    </View>
  );

  const renderPrivacy = () => (
    <View style={styles.content}>
      {renderHeader('Privacy', true)}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Visibility</Text>
          {renderToggleRow(
            <Globe size={20} color={Colors.dark.primary} />,
            'Public Profile',
            privacy.profilePublic,
            (val) => setPrivacy({ ...privacy, profilePublic: val }),
            'Anyone can view your profile'
          )}
          {renderToggleRow(
            <Eye size={20} color={Colors.dark.primary} />,
            'Show Contributions',
            privacy.showContributions,
            (val) => setPrivacy({ ...privacy, showContributions: val }),
            'Display your track contributions publicly'
          )}
          {renderToggleRow(
            <User size={20} color={Colors.dark.primary} />,
            'Show Favorites',
            privacy.showFavorites,
            (val) => setPrivacy({ ...privacy, showFavorites: val }),
            'Let others see your favorite sets'
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interactions</Text>
          {renderToggleRow(
            <Shield size={20} color={Colors.dark.primary} />,
            'Allow Tagging',
            privacy.allowTagging,
            (val) => setPrivacy({ ...privacy, allowTagging: val }),
            'Others can tag you in comments'
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Security</Text>
          {renderSettingRow(
            <Lock size={20} color={Colors.dark.primary} />,
            'Change Password',
            () => Alert.alert('Change Password', 'Password change flow would open here')
          )}
          {renderSettingRow(
            <Smartphone size={20} color={Colors.dark.primary} />,
            'Two-Factor Authentication',
            () => Alert.alert('2FA', 'Two-factor authentication setup would open here')
          )}
          {renderSettingRow(
            <FileText size={20} color={Colors.dark.primary} />,
            'Download My Data',
            () => Alert.alert('Download Data', 'Your data export will be prepared')
          )}
        </View>
      </ScrollView>
    </View>
  );

  const renderNotifications = () => (
    <View style={styles.content}>
      {renderHeader('Notifications', true)}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Notifications</Text>
          {renderToggleRow(
            <Bell size={20} color={Colors.dark.primary} />,
            'Enable Push Notifications',
            notifications.pushEnabled,
            (val) => setNotifications({ ...notifications, pushEnabled: val })
          )}
        </View>

        <View style={[styles.section, !notifications.pushEnabled && styles.sectionDisabled]}>
          <Text style={styles.sectionTitle}>Notification Types</Text>
          {renderToggleRow(
            <Shield size={20} color={notifications.pushEnabled ? Colors.dark.primary : Colors.dark.textMuted} />,
            'Track Verified',
            notifications.trackVerified && notifications.pushEnabled,
            (val) => setNotifications({ ...notifications, trackVerified: val }),
            'When your submitted track is verified'
          )}
          {renderToggleRow(
            <User size={20} color={notifications.pushEnabled ? Colors.dark.primary : Colors.dark.textMuted} />,
            'New Followers',
            notifications.newFollowers && notifications.pushEnabled,
            (val) => setNotifications({ ...notifications, newFollowers: val }),
            'When someone follows you'
          )}
          {renderToggleRow(
            <Globe size={20} color={notifications.pushEnabled ? Colors.dark.primary : Colors.dark.textMuted} />,
            'Set Updates',
            notifications.setUpdates && notifications.pushEnabled,
            (val) => setNotifications({ ...notifications, setUpdates: val }),
            'Updates to sets you follow'
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email</Text>
          {renderToggleRow(
            <Mail size={20} color={Colors.dark.primary} />,
            'Email Notifications',
            notifications.emailNotifications,
            (val) => setNotifications({ ...notifications, emailNotifications: val }),
            'Receive notifications via email'
          )}
          {renderToggleRow(
            <FileText size={20} color={Colors.dark.primary} />,
            'Weekly Digest',
            notifications.weeklyDigest,
            (val) => setNotifications({ ...notifications, weeklyDigest: val }),
            'Summary of activity and new sets'
          )}
        </View>
      </ScrollView>
    </View>
  );

  const renderMainSettings = () => (
    <View style={styles.content}>
      {renderHeader('Settings')}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          {renderSettingRow(
            <User size={20} color={Colors.dark.primary} />,
            'Edit Profile',
            () => setCurrentSection('edit-profile')
          )}
          {renderSettingRow(
            <Shield size={20} color={Colors.dark.primary} />,
            'Privacy',
            () => setCurrentSection('privacy')
          )}
          {renderSettingRow(
            <Bell size={20} color={Colors.dark.primary} />,
            'Notifications',
            () => setCurrentSection('notifications')
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          {renderSettingRow(
            <Moon size={20} color={Colors.dark.primary} />,
            'Appearance',
            () => Alert.alert('Appearance', 'Theme settings coming soon!')
          )}
          {renderSettingRow(
            <Globe size={20} color={Colors.dark.primary} />,
            'Language',
            () => Alert.alert('Language', 'Language settings coming soon!'),
            <Text style={styles.settingValue}>English</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          {renderSettingRow(
            <HelpCircle size={20} color={Colors.dark.primary} />,
            'Help Center',
            () => Alert.alert('Help', 'Help center would open here')
          )}
          {renderSettingRow(
            <FileText size={20} color={Colors.dark.primary} />,
            'Terms of Service',
            () => Alert.alert('Terms', 'Terms of service would open here')
          )}
          {renderSettingRow(
            <Shield size={20} color={Colors.dark.primary} />,
            'Privacy Policy',
            () => Alert.alert('Privacy', 'Privacy policy would open here')
          )}
        </View>

        <View style={styles.section}>
          {renderSettingRow(
            <LogOut size={20} color={Colors.dark.error} />,
            'Log Out',
            handleLogout,
            undefined,
            true
          )}
          {renderSettingRow(
            <Trash2 size={20} color={Colors.dark.error} />,
            'Delete Account',
            handleDeleteAccount,
            undefined,
            true
          )}
        </View>

        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {currentSection === 'main' && renderMainSettings()}
        {currentSection === 'edit-profile' && renderEditProfile()}
        {currentSection === 'privacy' && renderPrivacy()}
        {currentSection === 'notifications' && renderNotifications()}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionDisabled: {
    opacity: 0.5,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 85, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingIconDanger: {
    backgroundColor: 'rgba(211, 47, 47, 0.1)',
  },
  settingLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.dark.text,
  },
  settingLabelDanger: {
    color: Colors.dark.error,
  },
  settingValue: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    marginRight: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  toggleContent: {
    flex: 1,
  },
  toggleDescription: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.dark.primary,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.dark.background,
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
    marginTop: 12,
  },
  formSection: {
    paddingHorizontal: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  usernameInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  usernamePrefix: {
    fontSize: 16,
    color: Colors.dark.textMuted,
    paddingLeft: 16,
  },
  usernameField: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingLeft: 4,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 32,
    marginBottom: 16,
  },
});
