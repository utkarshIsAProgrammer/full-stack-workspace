const User = ({ name, age, role }) => {
	return (
		<div>
			<ul>
				<li>Name: {name}</li>
				<li>Age: {age}</li>
				<li>Role: {role}</li>
			</ul>
		</div>
	);
};

export default User;
