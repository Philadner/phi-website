import { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';

import Home from './pages/Home';
import About from './pages/About';
import QuickLinks from './pages/QuickLinks';
import './App.css';





function App() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true);
      console.log("loader done")
     }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
     <div className={loaded ? 'loaded page' : 'page'}>

      <header>
        <Link to="/" className="logo">phi(l)</Link>
        <nav>
          <Link to="/about">About</Link>
          <Link to="/quickl">Quick links</Link>
          <Link to="/hehehe">hehehe</Link>
        </nav>
      </header>

      {loaded && (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/quickl" element={<QuickLinks />} />
        </Routes>
      )}
    </div>
  );
}



export default App;
