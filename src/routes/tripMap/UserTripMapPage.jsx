import AdminTripMapPage from '../admin/AdminTripMapPage.jsx'
import '../admin/adminTheme.css'
import './userTripMapPage.css'

const UserTripMapPage = () => {
  return (
    <div className="user-trip-map-shell adminShell">
      <div className="admin-main-inner user-trip-map-inner">
        <AdminTripMapPage userView />
      </div>
    </div>
  )
}

export default UserTripMapPage
