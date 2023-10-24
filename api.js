const client = require("./connection.js");
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const passport = require("passport");
const app = express();
app.use(bodyParser.json());
client.connect();
app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);
app.use(passport.initialize());
app.use(passport.session());
async function startServer() {
  const server = new ApolloServer({
    typeDefs: `
          type User {
              id: ID!
              name: String!
          }
          type Blog {
            id: ID!
            title: String!
            content: String!
            writer: String!
          }
          type Query {
            getUsers: [User]
            getBlogs: [Blog]
            getBlogsByWriter: [Blog]
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
        getBlogsByWriter: async (parent, args) => {
          try {
            const { writer } = args;
            const queryResult = await client.query(
              "SELECT * FROM blogs WHERE writer = $1",
              [writer]
            );
            return queryResult.rows;
          } catch (error) {
            throw new Error("Error fetching blogs by writer from the database");
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

  await server.start();

  app.use("/graphql", expressMiddleware(server));
}

const LocalStrategy = require("passport-local").Strategy;

passport.use(
  new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      console.log("email", email);
      try {
        const user = await client.query(
          "SELECT * FROM users WHERE email = $1",
          [email]
        );
        if (!user.rows.length || !(user.rows[0].password === password)) {
          return done(null, false, { message: "Invalid email or password" });
        }
        return done(null, user.rows[0]);
      } catch (error) {
        return done(error);
      }
    }
  )
);

app.post(
  "/login",
  passport.authenticate("local", { session: false }),
  (req, res) => {
    console.log("req", res);
    if (req.user) {
      res.json({ success: true, user: req.user });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  }
);

var GoogleStrategy = require("passport-google-oauth20").Strategy;

passport.use(
  new GoogleStrategy(
    {
      clientID:
        "286681314953-8cllenpfi8bpqfa5oc7gp4b3helahsed.apps.googleusercontent.com",
      clientSecret: "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",
      callbackURL: "http://localhost:3000/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      const user = {
        id: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
      };

      db.query("INSERT INTO users (id, name, email) VALUES ($1, $2, $3)", [
        user.id,
        user.name,
        user.email,
      ]);
      console.log("user", user);
      req.session.user = user;
      done(null, user);
    }
  )
);

app.get("/auth/google", passport.authenticate("google"));

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/profile");
  }
);

app.get("/profile", passport.isAuthenticated(), (req, res) => {
  res.json({ user: req.user });
});
app.listen(8000, () => console.log("Server Started at 8000"));

startServer();
