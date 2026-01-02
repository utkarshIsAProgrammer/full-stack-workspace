// import Greetings from "./components/Greetings.jsx";

import Header from "./components/Header.jsx";
import { Footer } from "./components/Footer.jsx";
import MainContent from "./components/MainContent.jsx";

// component
const App = () => {
	return (
		<header>
			{/* <Greetings /> */}

			<Header />
			<MainContent />
			<Footer />
		</header>
	);
};

export default App;
