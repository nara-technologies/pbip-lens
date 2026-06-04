from datetime import datetime
from typing import List, Optional, Dict
import functools
import time

def execution_timer(func):
    """
    A decorator that logs execution time of a function.
    Highlights Python decorators, inner functions, and *args/**kwargs.
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()
        print(f"[Timer] {func.__name__} executed in {end_time - start_time:.4f} seconds.")
        return result
    return wrapper

class Product:
    """
    Represents a store product.
    Demonstrates Python OOP, standard variables, comments, and numeric literals.
    """
    category: str = "General"

    def __init__(self, item_id: int, name: str, price: float, tags: List[str]):
        self.item_id = item_id
        self.name = name
        self.price = price
        self.tags = tags
        self.created_at = datetime.utcnow()

    def get_discounted_price(self, discount_pct: float) -> float:
        # Calculate discount and ensure it isn't negative
        if not (0.0 <= discount_pct <= 1.0):
            raise ValueError("Discount must be between 0.0 and 1.0")
        return self.price * (1.0 - discount_pct)

    def __repr__(self) -> str:
        return f"<Product(name={self.name}, price=${self.price:.2f})>"


class InventoryManager:
    def __init__(self):
        self.items: Dict[int, Product] = {}

    @execution_timer
    def add_product(self, product: Product) -> None:
        self.items[product.item_id] = product

    def find_by_tag(self, tag: str) -> List[Product]:
        """
        Demonstrates list comprehension, variable assignment, and string comparison.
        """
        # Find all products that contain the given tag
        matching_products = [
            prod for prod in self.items.values()
            if tag.lower() in [t.lower() for t in prod.tags]
        ]
        return matching_products


if __name__ == "__main__":
    # Instantiating objects to test theme highlighting
    manager = InventoryManager()
    
    laptop = Product(
        item_id=101, 
        name="UltraBook 15", 
        price=1299.99, 
        tags=["electronics", "computer", "laptop"]
    )
    
    mouse = Product(
        item_id=102, 
        name="Wireless Mouse", 
        price=49.95, 
        tags=["electronics", "peripheral"]
    )

    manager.add_product(laptop)
    manager.add_product(mouse)

    print("Search Results for 'electronics':")
    for item in manager.find_by_tag("electronics"):
        print(f" - {item}: ${item.get_discounted_price(0.1):.2f} (with 10% discount)")
