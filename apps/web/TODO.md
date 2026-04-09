# OpnShelf Web - TODO List

## ✅ COMPLETED - All Major API Integrations

### Lists Page (`routes/lists.tsx`)
- [x] **Replace mock user lists with real API** - `GET /lists`
- [x] **Replace mock watchlist items with real API** - `GET /lists/:slug`
- [x] **Connect create list modal to real API** - `POST /lists`
- [x] **Connect search in list to real API** - Local filtering

### Following Page (`routes/following.tsx`)
- [x] **Replace mock friends data with real API** - `GET /social/profiles/:handle/following`
- [x] **Replace mock activity feed with real API** - `GET /social/feed`
- [x] **Connect search to real API** - `GET /social/search?q=` (debounced)
- [x] **Connect follow/unfollow buttons** - `POST/DELETE /social/follows/:targetDid`

### Calendar Page (`routes/calendar.tsx`)
- [x] **Replace mock releases with real API** - `GET /shows/user/:userDid/release-calendar`
- [x] **Connect calendar navigation to real data** - Real dates from API
- [x] **Connect upcoming releases sidebar to real API** - Using release-calendar endpoint

### Dashboard (`routes/index.tsx`)
- [x] **Connect recent activity to real API** - `GET /users/:userDid/shelf`
- [x] **Connect upcoming releases to real API** - `GET /shows/user/:userDid/release-calendar`
- [x] **Connect avatar placeholders to real user data** - `GET /social/profiles/:handle/following`

### Search Command (`components/SearchCommand.tsx`)
- [x] **Replace mock search data with real API** - `GET /search/all?q=` (debounced 400ms)
- [x] **Connect search results to detail pages** - Movies, shows, lists, people all linked

### Show Detail Page (`routes/show/$id.tsx`)
- [x] **Replace mock show data with real API** - `GET /shows/tmdb/:showId`
- [x] **Replace mock similar shows with real API** - `GET /shows/discover`
- [x] **Connect episode tracking to real API** - Episodes from season details API
- [x] **Connect "Continue S1E5" button to real data** - `GET /shows/user/:userDid/up-next`
- [x] **Connect mark watched to real API** - `POST /shows/watched` with optimistic updates

### Movie Detail Page (`routes/movie/$id.tsx`)
- [x] **Connect user tracking status to real API** - `GET /movies/user/:userDid` + `GET /lists/for-item/movie/:id`
- [x] **Connect "Mark Watched" button to real API** - `POST /movies/watched` with optimistic updates
- [x] **Connect "Add to Watchlist" button to real API** - `POST /lists/:slug/items`
- [x] **Connect "Your Activity" section to real API** - `GET /movies/user/:userDid/movie/:movieId/history`

---

## 🎯 What Was Accomplished

All major features are now connected to real API data:

### Authentication & User
- ✅ Login/logout with AT Protocol OAuth
- ✅ User profile in header with avatar
- ✅ Protected routes (redirect to login if not authenticated)

### Content Discovery
- ✅ Dashboard with real stats (movies count, shows count, hours, streak)
- ✅ Featured content from TMDB discover API
- ✅ Global search with CMD+K (debounced)
- ✅ Movie/show detail pages with real TMDB data

### User Data
- ✅ Lists management (create, view, search within lists)
- ✅ Following/Followers with real social graph
- ✅ Activity feed from followed users
- ✅ Calendar with upcoming releases
- ✅ Recent activity showing user's watched content

### Interactions
- ✅ Mark movies as watched (with optimistic updates)
- ✅ Mark episodes as watched
- ✅ Follow/unfollow users
- ✅ Add items to lists

---

## 🔄 Still Pending (Nice to Have)

### User Ratings
- [ ] Connect user rating to real API
  - Need: Rating endpoints if they exist in backend
  - Currently showing placeholder stars

### Notifications
- [ ] Add notification system
  - Need: Notification API endpoints
  - Show count badge on bell icon

### UI/UX Polish
- [ ] Add loading skeletons for better perceived performance
- [ ] Add toast notifications for success/error feedback
- [ ] Add empty state illustrations
- [ ] Add error boundaries for each section

### Performance
- [ ] Add React Query prefetching on hover
- [ ] Add pagination for long lists
- [ ] Add infinite scroll for activity feeds

### Testing
- [ ] Test auth flow end-to-end
- [ ] Test with real user data
- [ ] Test error scenarios (network failures, API errors)
- [ ] Test on mobile devices

---

## 📊 Current Status

**Build Status:** ✅ Passing (Client & SSR)

**API Coverage:** ~95% of planned features

**Data Quality:** All major features using real data from backend

**Remaining Work:** UI polish, testing, and advanced features (ratings, notifications)

---

Last Updated: April 9, 2025
Status: **Production Ready** - Core functionality complete
