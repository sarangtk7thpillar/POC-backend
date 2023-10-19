const client = require("./connection.js");
const express = require("express");
const bodyParser = require("body-parser");
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");

async function startServer() {
  const app = express();
  client.connect();

  const server = new ApolloServer({
    typeDefs: `
          type User {
              id: ID!
              firstname: String!
              lastname: String!
          }
          type Blog {
            id: ID!
            title: String!
            content: String!
          }
          type Query {
               getUsers: [User]
               getBlogs: [Blog]
          }
          type Mutation {
            createBlog(title: String!, content: String!): Blog
            deleteBlog(id: ID!): Blog
            updateBlog(id:ID!, title:String!, content:String!): Blog
          }
          `,
    resolvers: {
      Query: {
        getUsers: async () => {
          try {
            const queryResult = await client.query("SELECT * FROM users");
            return queryResult.rows;
          } catch (error) {
            throw new Error("Error fetching users from the database");
          }
        },
        getBlogs: async () => {
          try {
            const queryResult = await client.query("SELECT * FROM blogs");
            return queryResult.rows;
          } catch (error) {
            throw new Error("Error fetching blogs from the database");
          }
        },
      },
      Mutation: {
        createBlog: async (parent, args) => {
          try {
            const queryResult = await client.query(
              "INSERT INTO blogs (title, content) VALUES ($1, $2) RETURNING *",
              [args.title, args.content]
            );

            return queryResult.rows[0];
          } catch (error) {
            throw new Error("Error creating a new blog in the database");
          }
        },
        deleteBlog: async (parent, args) => {
          try {
            const blogId = parseInt(args.id);

            const getBlogResult = await client.query(
              "SELECT * FROM blogs WHERE id = $1",
              [blogId]
            );

            if (getBlogResult.rows.length === 0) {
              throw new Error("Blog not found");
            }

            const deleteResult = await client.query(
              "DELETE FROM blogs WHERE id = $1 RETURNING *",
              [blogId]
            );

            if (deleteResult.rows.length === 0) {
              throw new Error("Error deleting the blog");
            }

            return deleteResult.rows[0];
          } catch (error) {
            throw new Error("Error deleting the blog post: " + error.message);
          }
        },
        updateBlog: async (parent, args) => {
          try {
            const { id, title, content } = args;

            const getBlogResult = await client.query(
              "SELECT * FROM blogs WHERE id = $1",
              [parseInt(id)]
            );

            if (getBlogResult.rows.length === 0) {
              throw new Error("Blog not found");
            }

            const updateResult = await client.query(
              "UPDATE blogs SET title = $1, content = $2 WHERE id = $3 RETURNING *",
              [title, content, id]
            );

            if (updateResult.rows.length === 0) {
              throw new Error("Error updating the blog");
            }

            return updateResult.rows[0];
          } catch (error) {
            throw new Error("Error updating the blog post: " + error.message);
          }
        },
      },
    },
  });

  app.use(bodyParser.json());
  await server.start();

  app.use("/graphql", expressMiddleware(server));
  app.listen(8000, () => console.log("Server Started at 8000"));
}

startServer();
