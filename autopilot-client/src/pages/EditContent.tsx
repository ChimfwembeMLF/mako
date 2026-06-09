import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/** Legacy route — redirects to inline editor on Content Engine. */
export default function EditContent() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) navigate(`/content?edit=${id}`, { replace: true });
    else navigate('/content', { replace: true });
  }, [id, navigate]);

  return null;
}
