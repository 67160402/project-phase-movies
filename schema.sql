CREATE DATABASE IF NOT EXISTS movie_api;
USE movie_api;

CREATE TABLE movies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  director VARCHAR(100) NOT NULL,
  release_year INT NOT NULL
);

CREATE TABLE genres (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE movie_genres (
  id INT AUTO_INCREMENT PRIMARY KEY,
  movie_id INT NOT NULL,
  genre_id INT NOT NULL,

  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
  FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE,
  UNIQUE KEY unique_movie_genre (movie_id, genre_id)
);