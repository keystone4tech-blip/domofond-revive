import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MediaItem {
  id: string;
  title: string;
  description: string;
  type: 'image' | 'document' | 'video';
  category: string;
  url: string;
  thumbnail?: string;
}

const MediaGallery = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  
  const mediaItems: MediaItem[] = [
    {
      id: '1',
      title: 'Пример изображения продукта',
      description: 'Изображение одного из наших продуктов',
      type: 'image',
      category: 'products',
      url: '/media/images/products/sample-image.jpg',
      thumbnail: '/media/images/products/sample-image.jpg'
    },
    {
      id: '2',
      title: 'Пример документа',
      description: 'Пример документа руководства',
      type: 'document',
      category: 'manuals',
      url: '/media/documents/manuals/sample-document.pdf',
      thumbnail: '/media/images/products/sample-image.jpg' // используем изображение как превью для документа
    }
  ];

  const categories = ['all', 'products', 'projects', 'team', 'manuals', 'certificates', 'contracts'];

  const filteredItems = activeCategory === 'all' 
    ? mediaItems 
    : mediaItems.filter(item => item.category === activeCategory);

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'image':
        return '🖼️';
      case 'document':
        return '📄';
      case 'video':
        return '🎬';
      default:
        return '📁';
    }
  };

  return (
    <section className="py-8 md:py-12">
      <div className="container">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            Медиафайлы
          </h2>
          <p className="text-muted-foreground mt-2">
            Пример использования файлов из папки media
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {categories.map(category => (
            <Badge
              key={category}
              variant={activeCategory === category ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setActiveCategory(category)}
            >
              {category === 'all' ? 'Все' : 
               category === 'products' ? 'Продукты' : 
               category === 'projects' ? 'Проекты' : 
               category === 'team' ? 'Команда' : 
               category === 'manuals' ? 'Руководства' : 
               category === 'certificates' ? 'Сертификаты' : 
               category === 'contracts' ? 'Контракты' : category}
            </Badge>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map(item => (
            <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative aspect-video overflow-hidden">
                {item.type === 'image' ? (
                  <img
                    src={item.thumbnail || item.url}
                    alt={item.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <div className="text-center">
                      <div className="text-4xl mb-2">{getTypeIcon(item.type)}</div>
                      <div className="text-sm text-muted-foreground">Предварительный просмотр</div>
                    </div>
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg">{item.title}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {getTypeIcon(item.type)} {item.type}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
                <a 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                >
                  {item.type === 'document' ? 'Открыть документ' : 'Просмотреть'}
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MediaGallery;