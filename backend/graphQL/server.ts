import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

const server = new ApolloServer({
	typeDefs: `#graphql
	type Post{
		id:ID!
		title:String!
		body:String!
		tags:[String]
	}`,

	resolvers: {
		Query: {
			id: () => "1",
			name: () => "IndieDev",
			age: () => 20,
			isProgrammer: () => true,
			gpa: () => 6.5,
		},
	},
});

const runServer = async () => {
	const { url } = await startStandaloneServer(server, {
		listen: { port: 5000 },
	});
	console.log(`Server is running at ${url}`);
};

runServer();
