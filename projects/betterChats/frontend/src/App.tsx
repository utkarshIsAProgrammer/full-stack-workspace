import { Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";

const App = () => {
	return (
		// <div className="bg-[url('./src/assets/bgImage.svg')] bg-cover">
		<div className="bg-[url('./src/assets/bg.jpg')] bg-cover bg-center">
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/login" element={<LoginPage />} />
				<Route path="/profile" element={<ProfilePage />} />
			</Routes>
		</div>
	);
};

export default App;
