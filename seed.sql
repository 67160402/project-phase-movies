USE movie_api;

INSERT INTO movies (title, director, release_year) VALUES
  ('Inception', 'Christopher Nolan', 2010),
  ('Interstellar', 'Christopher Nolan', 2014),
  ('Parasite', 'Bong Joon-ho', 2019),
  ('The Dark Knight', 'Christopher Nolan', 2008),
  ('The Matrix', 'Lana Wachowski, Lilly Wachowski', 1999),
  ('Spider-Man', 'Sam Raimi', 2002),
  ('Spider-Man: Homecoming', 'Jon Watts', 2017),
  ('Spider-Man: Into the Spider-Verse', 'Rodney Rothman', 2018),
  ('The Avengers', 'Joss Whedon', 2012),
  ('Avengers: Endgame', 'Anthony Russo, Joe Russo', 2019),
  ('The Shawshank Redemption', 'Frank Darabont', 1994),
  ('The Godfather', 'Francis Ford Coppola', 1972);

INSERT INTO genres (name) VALUES
  ('Sci-Fi'),
  ('Drama'),
  ('Thriller'),
  ('Action'),
  ('Animation'),
  ('Crime');

INSERT INTO movie_genres (movie_id, genre_id) VALUES
  (1, 1),
  (1, 3),
  (2, 1),
  (2, 2),
  (3, 2),
  (3, 3),
  (4, 4),
  (4, 6),
  (4, 2),
  (5, 5),
  (6, 1),
  (6, 4),
  (7, 6),
  (7, 2),
  (8, 5),
  (8, 2);
