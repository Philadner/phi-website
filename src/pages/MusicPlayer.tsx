import { useState } from 'react';

interface ArchiveItem {
  identifier: string;
  title: string;
}

function ArchiveMusicSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ArchiveItem[]>([]);
  const [audioUrls, setAudioUrls] = useState<{ [key: string]: string[] }>({});

  const fetchMusic = async () => {
    try {
      const response = await fetch(
        `https://archive.org/advancedsearch.php?q=title:"${encodeURIComponent(query)}"&fl[]=identifier,title&sort[]=downloads+desc&rows=10&output=json`
      );
      const data = await response.json();
      const items: ArchiveItem[] = data.response.docs;
      setResults(items);

      // Fetch audio files for each item
      const audioFiles: { [key: string]: string[] } = {};
      for (const item of items) {
        const metaResponse = await fetch(`https://archive.org/metadata/${item.identifier}`);
        const metaData = await metaResponse.json();
        const files = metaData?.files || [];
        audioFiles[item.identifier] = files
          .filter((file: any) => file.format && file.format.toLowerCase().includes('audio'))
          .map((file: any) => `https://archive.org/download/${item.identifier}/${file.name}`);
      }
      setAudioUrls(audioFiles);
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
      <span className='FancyLink' onClick={fetchMusic}> Search</span>
      <ul>
        {results.map((item) => (
          <li key={item.identifier}>
            <a href={`https://archive.org/details/${item.identifier}`} target="_blank" rel="noopener noreferrer">
              {item.title}
            </a>
            {audioUrls[item.identifier]?.map((url, index) => (
              <div className='FancyLink' key={index}>
                <audio controls>
                  <source src={url} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
                <p>File: {url.split('/').pop()}</p>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ArchiveMusicSearch;
