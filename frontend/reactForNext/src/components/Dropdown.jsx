import { useState } from "react";

const Dropdown = () => {
	let [open, setOpen] = useState(false);

	return (
		<div>
			<button
				onClick={() => {
					setOpen((open) => !open);
				}}>
				Show Dropdown
			</button>
			{open && (
				<ul
					style={{
						border: "1px solid #ccc",
						padding: "10px",
						width: "100px",
					}}>
					<li>Profile</li>
					<li>Setting</li>
					<li>Logout</li>
				</ul>
			)}
		</div>
	);
};

export default Dropdown;
