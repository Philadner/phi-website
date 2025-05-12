import { useState } from 'react';

interface ArchiveItem {
  identifier: string;
  title: string;
}

function ArchiveMusicSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ArchiveItem[]>([]);

  const fetchMusic = async () => {
    try {
      const response = await fetch(
        `https://archive.org/advancedsearch.php?q=title:"${encodeURIComponent(query)}"&fl[]=identifier,title&sort[]=downloads+desc&rows=10&output=json`
      );
      const data = await response.json();
      // Properly typecast the response
      const items: ArchiveItem[] = data.response.docs;
      setResults(items);
    } catch (err) {
      console.error("Error fetching music:", err);
    }
  };

  return (
    <div>
      <h2>Archive.org Music Search</h2>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for music"
      />
      <button onClick={fetchMusic}>Search</button>
      <ul>
        {results.map((item) => (
          <li key={item.identifier}>
            <a href={`https://archive.org/details/${item.identifier}`} target="_blank" rel="noopener noreferrer">
              {item.title}
            </a>
            <audio controls>
              <source src={`https://archive.org/download/${item.identifier}/${item.identifier}.mp3`} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ArchiveMusicSearch;
