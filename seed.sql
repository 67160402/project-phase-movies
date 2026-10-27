USE movie_api;

INSERT INTO movies (title, director, release_year) VALUES
  ('Inception', 'Christopher Nolan', 2010),
  ('Interstellar', 'Christopher Nolan', 2014),
  ('Parasite', 'Bong Joon-ho', 2019);

INSERT INTO genres (name) VALUES
  ('Sci-Fi'),
  ('Drama'),
  ('Thriller');

INSERT INTO movie_genres (movie_id, genre_id) VALUES
  (1, 1),
  (1, 3),
  (2, 1),
  (2, 2),
  (3, 2),
  (3, 3);