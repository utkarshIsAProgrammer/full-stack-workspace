const Form = () => {
	function handleSubmit(event) {
		event.preventDefault();
		alert("Form Submitted!");
	}

	return (
		<form onSubmit={handleSubmit}>
			<input type="text" />
			<button>Send</button>
		</form>
	);
};

export default Form;
