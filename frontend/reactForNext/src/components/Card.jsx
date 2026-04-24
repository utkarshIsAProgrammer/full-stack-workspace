const Card = ({ children }) => {
	return (
		<div
			style={{
				border: "2px solid black",
				padding: "20px",
				width: "200px",
				textAlign: "center",
			}}>
			{children}
		</div>
	);
};

export default Card;
