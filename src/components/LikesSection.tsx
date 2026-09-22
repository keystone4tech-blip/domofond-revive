import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateUUID } from "@/lib/uuid";

interface LikesSectionProps {
  contentType: "promotion" | "news";
  contentId: string;
}

export const LikesSection = ({ contentType, contentId }: LikesSectionProps) => {
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    // Безопасно получаем или создаем session ID для анонимных пользователей (с фоллбеком для HTTP)
    let sid = localStorage.getItem("session_id");
    if (!sid) {
      sid = generateUUID();
      localStorage.setItem("session_id", sid);
    }
    setSessionId(sid);
    
    fetchLikes();
    checkIfLiked(sid);
  }, [contentId]);

  const fetchLikes = async () => {
    try {
      const { data, error } = await supabase
        .from("likes")
        .select("id")
        .eq("content_type", contentType)
        .eq("content_id", contentId);

      if (!error && data) {
        setLikesCount(data.length);
      }
    } catch (e) {
      console.error("[LikesSection] Ошибка получения количества лайков:", e);
    }
  };

  const checkIfLiked = async (sid: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      let query = supabase
        .from("likes")
        .select("id")
        .eq("content_type", contentType)
        .eq("content_id", contentId);

      if (user) {
        query = query.eq("user_id", user.id);
      } else {
        query = query.eq("session_id", sid);
      }

      // Используем maybeSingle вместо single, чтобы отсутствие записей не вызывало ошибку 406
      const { data } = await query.maybeSingle();
      setIsLiked(!!data);
    } catch (e) {
      console.error("[LikesSection] Ошибка проверки статуса лайка:", e);
    }
  };

  const handleLike = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (isLiked) {
      // Удаляем лайк
      let query = supabase
        .from("likes")
        .delete()
        .eq("content_type", contentType)
        .eq("content_id", contentId);

      if (user) {
        query = query.eq("user_id", user.id);
      } else {
        query = query.eq("session_id", sessionId);
      }

      const { error } = await query;

      if (!error) {
        setIsLiked(false);
        setLikesCount(prev => prev - 1);
      }
    } else {
      // Добавляем лайк
      const { error } = await supabase
        .from("likes")
        .insert({
          content_type: contentType,
          content_id: contentId,
          user_id: user?.id || null,
          session_id: user ? null : sessionId,
        });

      if (!error) {
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось поставить лайк",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLike}
      className="gap-2"
    >
      <Heart className={`h-5 w-5 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
      <span>{likesCount}</span>
    </Button>
  );
};
