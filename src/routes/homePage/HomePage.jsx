import { Link } from "react-router-dom"
import "./homePage.css"

const HomePage = () => {
  return (
    <div className="homepage">
      <div className="left">
        <h1>
          <span>T</span>
          <span>r</span>
          <span>A</span>
          <span>v</span>
          <span>e</span>
          <span>l</span>
        </h1>
        <h2>Find the perfect place for your next adventure</h2>
        <h3>
          Our AI travel assistant helps you explore destinations, discover hidden gems,
          and plan unforgettable trips effortlessly.
        </h3>
        <Link to="/dashboard">Get Started</Link>
      </div>

      <div className="right">
        <div className="imgContainer">
          <div className="bgContainer">
            <div className="bg"></div>
          </div>
          <img src="/bot.png" alt="" className="bot" />
        </div>
      </div>

      <div className="terms">
        <div className="links">
          <Link to="/">Terms of Service</Link>
          <span>|</span>
          <Link to="/">Privacy Policy</Link>
        </div>
      </div>
    </div>
  )
}

export default HomePage
