USE movie_api;

INSERT INTO movies (title, director, release_year) VALUES
  ('Inception', 'Christopher Nolan', 2010),
  ('Interstellar', 'Christopher Nolan', 2014),
  ('Parasite', 'Bong Joon-ho', 2019),
  ('The Dark Knight', 'Christopher Nolan', 2008),
  ('Spirited Away', 'Hayao Miyazaki', 2001),
  ('The Matrix', 'Lana Wachowski, Lilly Wachowski', 1999),
  ('Pulp Fiction', 'Quentin Tarantino', 1994),
  ('Your Name', 'Makoto Shinkai', 2016);

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
