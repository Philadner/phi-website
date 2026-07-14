import { Navigate, Route, Routes, useParams } from "react-router-dom"
import MusicPlayer from "./MusicPlayer"

function RoutedAlbumPlayer() {
  const { id } = useParams<{ id: string }>()
  return <MusicPlayer initialAlbumId={id ?? null} initialArtistId={null} />
}

function RoutedArtistPlayer() {
  const { artistId } = useParams<{ artistId: string }>()
  return <MusicPlayer initialAlbumId={null} initialArtistId={artistId ?? null} />
}

export default function MusicPLRouter() {
  return (
    <Routes>
      <Route index element={<MusicPlayer initialAlbumId={null} initialArtistId={null} />} />
      <Route path="artist/:artistId" element={<RoutedArtistPlayer />} />
      <Route path=":id" element={<RoutedAlbumPlayer />} />
      <Route path="*" element={<Navigate to="/musicpl" replace />} />
    </Routes>
  )
}
