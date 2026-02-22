import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import CustomAlert, { useCustomAlert } from '../../components/CustomAlert';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import {
  ADMIN_COLORS,
  ADMIN_SPACING,
  ADMIN_RADIUS,
  ADMIN_TYPOGRAPHY,
  ADMIN_SHADOWS,
  ADMIN_SURFACES,
} from '../../constants/adminTheme';

const REGIONS = ['Global', 'London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow'];
const ACCOLADES = ['admin', 'community_support', 'beta', 'staff', 'verified_athlete', 'founding_member', 'challenge_master'];

// Accolade display labels
const ACCOLADE_LABELS = {
  admin: 'ADMIN',
  community_support: 'SUPPORT',
  beta: 'BETA TESTER',
  staff: 'STAFF',
  verified_athlete: 'VERIFIED ATHLETE',
  founding_member: 'FOUNDER',
  challenge_master: 'CHALLENGE MASTER',
};

const getAccoladeLabel = (accolade) => ACCOLADE_LABELS[accolade] || accolade.replace('_', ' ').toUpperCase();

const C = ADMIN_COLORS;
const S = ADMIN_SPACING;
const R = ADMIN_RADIUS;
const T = ADMIN_TYPOGRAPHY;

export default function UserManagementScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedAccolade, setSelectedAccolade] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 400);

    return () => clearTimeout(handle);
  }, [searchQuery]);

  const loadUsers = async (page = 1, reset = false) => {
    try {
      const isPaginating = !reset && page > 1;
      if (reset) {
        setLoading(true);
      }
      if (isPaginating) {
        setLoadingMore(true);
      }
      // Build query string manually
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(selectedRegion && selectedRegion !== 'all' && { region: selectedRegion }),
        ...(selectedAccolade && selectedAccolade !== 'all' && { accolade: selectedAccolade }),
        sortBy,
        sortOrder,
      }).toString();

      const response = await api.get(`/api/admin/users?${queryParams}`);

      if (response?.success) {
        const newUsers = response.data.users;
        if (page === 1 || reset) {
          setUsers(newUsers);
        } else {
          setUsers(prev => [...prev, ...newUsers]);
        }
        setFilteredUsers(newUsers);
        setPagination(response.data.pagination);
        setTotalPages(response.data.pagination.pages);
        setCurrentPage(response.data.pagination.page);
      }
    } catch (err) {
      console.error('Error loading users:', err);
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to load users',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadUsers(1, true);
  }, [debouncedSearch, selectedRegion, selectedAccolade, sortBy, sortOrder]);

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers(1, true);
  };

  const loadMore = () => {
    if (currentPage < totalPages && !loading && !loadingMore && !refreshing) {
      loadUsers(currentPage + 1, false);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return 'chevron-expand';
    return sortOrder === 'asc' ? 'chevron-up' : 'chevron-down';
  };

  const UserItem = ({ user }) => {
    const isAdmin = user.accolades?.includes('admin');
    const isCommunitySupport = user.accolades?.includes('community_support');
    const hasAccolade = isAdmin || isCommunitySupport;

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => navigation.navigate('AdminUserDetail', { userId: user.id })}
        activeOpacity={0.7}
      >
        <View style={styles.userAvatarContainer}>
          {user.profileImage ? (
            <Image source={{ uri: user.profileImage }} style={styles.userAvatar} />
          ) : (
            <View style={[styles.userAvatarPlaceholder]}>
              <Text style={styles.userAvatarInitial}>
                {String(user.name || user.username || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {hasAccolade && (
            <View style={[styles.adminBadge, { backgroundColor: isAdmin ? C.accent : C.warning }]}>
              <Ionicons name={isAdmin ? 'shield' : 'star'} size={8} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName}>{String(user.name || 'Unknown')}</Text>
            <View style={styles.userBadges}>
              {user.accolades?.slice(0, 2).map((accolade, index) => (
                <View key={`${accolade}-${index}`} style={styles.accoladeBadge}>
                  <Text style={styles.accoladeBadgeText}>{getAccoladeLabel(accolade)}</Text>
                </View>
              ))}
              {(user.accolades?.length || 0) > 2 && (
                <View style={styles.accoladeBadge}>
                  <Text style={styles.accoladeBadgeText}>+{(user.accolades?.length || 0) - 2}</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.userHandle}>@{String(user.username || 'unknown')}</Text>
          <View style={styles.userStats}>
            <View style={styles.userStatItem}>
              <Ionicons name="location" size={10} color={C.textSubtle} />
              <Text style={styles.userStatText}>{String(user.region || 'Global')}</Text>
            </View>
            <View style={styles.userStatDot} />
            <View style={styles.userStatItem}>
              <Ionicons name="trophy" size={10} color={C.warning} />
              <Text style={styles.userStatText}>{Number(user.totalPoints || 0).toLocaleString()} XP</Text>
            </View>
            <View style={styles.userStatDot} />
            <View style={styles.userStatItem}>
              <Ionicons name="medal" size={10} color={C.info} />
              <Text style={styles.userStatText}>Rank {Number(user.rank || 99)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.userRight}>
          <View style={styles.userPointsContainer}>
            <Text style={styles.userPoints}>{Number(user.totalPoints || 0).toLocaleString()}</Text>
            <Text style={styles.userPointsLabel}>XP</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textSubtle} />
        </View>
      </TouchableOpacity>
    );
  };

  const FilterChip = ({ label, value, selected, onPress }) => (
    <TouchableOpacity
      style={[styles.filterChip, selected && styles.filterChipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + S.lg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.pageTitle}>USER MANAGEMENT</Text>
          <Text style={styles.pageSubtitle}>Browse and manage users</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchIconContainer}>
          <Ionicons name="search" size={18} color={C.textSubtle} />
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, username, or email..."
          placeholderTextColor={C.textSubtle}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={18} color={C.textSubtle} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filtersSection}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>REGION</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {['all', ...REGIONS].map(region => (
              <FilterChip
                key={region}
                label={region === 'all' ? 'All' : region}
                value={region}
                selected={selectedRegion === region}
                onPress={() => setSelectedRegion(region)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>ACCOLADE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {['all', ...ACCOLADES].map(accolade => (
              <FilterChip
                key={accolade}
                label={accolade === 'all' ? 'All' : getAccoladeLabel(accolade)}
                value={accolade}
                selected={selectedAccolade === accolade}
                onPress={() => setSelectedAccolade(accolade)}
              />
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>SORT BY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortScroll}>
          {[
            { field: 'createdAt', label: 'Join Date' },
            { field: 'totalPoints', label: 'Points' },
            { field: 'weeklyPoints', label: 'Weekly XP' },
            { field: 'name', label: 'Name' },
            { field: 'rank', label: 'Rank' },
          ].map(option => (
            <TouchableOpacity
              key={option.field}
              style={[styles.sortOption, sortBy === option.field && styles.sortOptionSelected]}
              onPress={() => handleSort(option.field)}
            >
              <Text style={[styles.sortOptionText, sortBy === option.field && styles.sortOptionTextSelected]}>
                {option.label}
              </Text>
              <Ionicons
                name={getSortIcon(option.field)}
                size={12}
                color={sortBy === option.field ? C.accent : C.textSubtle}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Users List */}
      {loading && users.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={styles.loadingText}>Loading users...</Text>
          </View>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="people-outline" size={40} color={C.textSubtle} />
            </View>
            <Text style={styles.emptyTitle}>No users found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
          }
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
            if (isCloseToBottom) {
              loadMore();
            }
          }}
          scrollEventThrottle={400}
        >
          {pagination && (
            <View style={styles.paginationInfo}>
              <Text style={styles.paginationText}>
                Showing {users.length} of {pagination.total} users
              </Text>
            </View>
          )}

          {users.map(user => (
            <UserItem key={user.id} user={user} />
          ))}

          {loadingMore && (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={C.accent} />
              <Text style={styles.loadingMoreText}>Loading more...</Text>
            </View>
          )}

          {currentPage >= totalPages && users.length > 0 && (
            <View style={styles.endOfList}>
              <View style={styles.endOfListLine} />
              <Text style={styles.endOfListText}>End of list</Text>
              <View style={styles.endOfListLine} />
            </View>
          )}
        </ScrollView>
      )}

      {/* Custom Alert */}
      <CustomAlert {...alertConfig} onClose={hideAlert} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: ADMIN_SURFACES.page,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.xl,
    paddingBottom: S.lg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  headerContent: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  pageSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textSubtle,
    marginTop: 2,
    letterSpacing: 0.8,
  },
  headerRight: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    marginHorizontal: S.xl,
    marginTop: S.lg,
    marginBottom: S.md,
    paddingHorizontal: S.md,
    borderRadius: R.lg,
    height: 48,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchIconContainer: {
    marginRight: S.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: C.text,
    paddingVertical: 0,
  },
  clearButton: {
    padding: S.xs,
    marginLeft: S.sm,
  },
  filtersSection: {
    paddingBottom: S.sm,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: S.sm,
  },
  filterLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1.2,
    width: 70,
    paddingLeft: S.xl,
  },
  filterScroll: {
    paddingRight: S.xl,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: C.card,
    borderRadius: R.pill,
    marginRight: S.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterChipSelected: {
    backgroundColor: C.accentSoft,
    borderColor: C.accent,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 0.3,
  },
  filterChipTextSelected: {
    color: C.accent,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.xl,
    paddingTop: S.xs,
    paddingBottom: S.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sortLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1.2,
    marginRight: S.sm,
  },
  sortScroll: {
    flexGrow: 1,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: C.card,
    borderRadius: R.pill,
    marginRight: S.sm,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  sortOptionSelected: {
    backgroundColor: C.accentSoft,
    borderColor: C.accent,
  },
  sortOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 0.3,
  },
  sortOptionTextSelected: {
    color: C.accent,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: S.xl,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: S.md,
    fontSize: 13,
    fontWeight: '500',
    color: C.textMuted,
    letterSpacing: 0.3,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: S.xxl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    marginBottom: S.sm,
    letterSpacing: 0.3,
  },
  emptySubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: C.textMuted,
    letterSpacing: 0.3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: S.xl,
    paddingBottom: S.xxl,
    paddingTop: S.md,
  },
  paginationInfo: {
    paddingVertical: S.md,
    alignItems: 'center',
    marginBottom: S.sm,
  },
  paginationText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textSubtle,
    letterSpacing: 0.5,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.md,
    marginBottom: S.md,
    borderWidth: 1,
    borderColor: C.border,
    ...ADMIN_SHADOWS.soft,
  },
  userAvatarContainer: {
    marginRight: S.md,
    position: 'relative',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: R.md,
    borderWidth: 2,
    borderColor: C.border,
  },
  userAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 2,
    borderColor: C.border,
  },
  userAvatarInitial: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
    letterSpacing: 0.5,
  },
  adminBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.card,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    marginRight: 8,
    letterSpacing: 0.2,
  },
  userBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  accoladeBadge: {
    backgroundColor: C.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: R.xs,
    marginRight: 4,
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  accoladeBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  userHandle: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textSubtle,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  userStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  userStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  userStatText: {
    fontSize: 10,
    fontWeight: '600',
    color: C.textSubtle,
    letterSpacing: 0.3,
  },
  userStatDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: C.borderSoft,
    marginHorizontal: 6,
  },
  userRight: {
    alignItems: 'flex-end',
    marginLeft: S.sm,
  },
  userPointsContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  userPoints: {
    fontSize: 14,
    fontWeight: '900',
    color: C.accent,
    letterSpacing: -0.5,
  },
  userPointsLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: S.xl,
    gap: S.sm,
  },
  loadingMoreText: {
    fontSize: 12,
    fontWeight: '500',
    color: C.textMuted,
    letterSpacing: 0.3,
  },
  endOfList: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: S.xl,
    gap: S.md,
  },
  endOfListLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  endOfListText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textSubtle,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
